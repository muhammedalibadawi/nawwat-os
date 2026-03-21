import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// --- Types ---
export interface WebhookEvent {
    id: string;
    tenant_id: string;
    channel_account_id: string;
    channel_name: string;
    source_event_id: string | null;
    event_type: string;
    status: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
    age?: any; // Postgres Interval representation
}

export interface SyncJob {
    id: string;
    tenant_id: string;
    channel_account_id: string;
    channel_name: string;
    job_type: string;
    status: string;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    last_error: string | null;
}

// --- Hooks ---

export function useWebhooks() {
    const [pending, setPending] = useState<WebhookEvent[]>([]);
    const [failed, setFailed] = useState<WebhookEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWebhooks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch Pending (ordered oldest first to see what is stuck)
            const { data: pendingData, error: pendingErr } = await supabase
                .from('commerce_pending_webhooks_v')
                .select('*')
                .order('created_at', { ascending: true });

            if (pendingErr) throw pendingErr;

            // Fetch Failed (ordered newest first)
            const { data: failedData, error: failedErr } = await supabase
                .from('commerce_failed_webhooks_v')
                .select('*')
                .order('created_at', { ascending: false });

            if (failedErr) throw failedErr;

            setPending(pendingData || []);
            setFailed(failedData || []);
        } catch (err: any) {
            console.error('Error fetching webhooks:', err);
            setError(err.message || 'Failed to load webhooks');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchWebhooks();
    }, [fetchWebhooks]);

    return { pending, failed, loading, error, refetch: fetchWebhooks };
}


export function useFailedSyncJobs() {
    const [jobs, setJobs] = useState<SyncJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchErr } = await supabase
                .from('commerce_failed_sync_jobs_v')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchErr) throw fetchErr;
            setJobs(data || []);
        } catch (err: any) {
            console.error('Error fetching failed sync jobs:', err);
            setError(err.message || 'Failed to load sync jobs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    return { jobs, loading, error, refetch: fetchJobs };
}


export function useRetryWebhook() {
    const [isRetrying, setIsRetrying] = useState(false);

    const retryWebhook = async (eventId: string): Promise<{ success: boolean; error?: string }> => {
        setIsRetrying(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('retry_inbound_webhook', {
                p_event_id: eventId
            });

            if (rpcError) throw rpcError;
            
            if (data === true) {
                return { success: true };
            } else {
                return { success: false, error: 'RPC returned false or no data' };
            }
        } catch (err: any) {
            console.error('Retry failed:', err);
            return { success: false, error: err.message || 'Failed to retry webhook' };
        } finally {
            setIsRetrying(false);
        }
    };

    return { retryWebhook, isRetrying };
}


export interface MappingReadinessData {
    canonical_sku_id: string;
    tenant_id: string;
    item_id: string;
    sku: string;
    total_mappings: number;
    confirmed_mappings: number;
    suggested_mappings: number;
    blocked_mappings: number;
}

export interface SkuMapping {
    mapping_id: string;
    tenant_id: string;
    canonical_sku_id: string;
    item_id: string;
    sku: string;
    channel_account_id: string;
    channel_name: string;
    channel_item_id: string;
    external_variant_id: string;
    mapping_status: string;
    confidence_score: number;
    rejected_reason: string | null;
    confirmed_at: string | null;
    last_validated_at: string | null;
}

export function useMappingReadiness() {
    const [readiness, setReadiness] = useState<{ total_skus: number; mapped_skus: number; unmapped_skus: number; mapping_percentage: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReadiness = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchErr } = await supabase
                .from('commerce_mapping_readiness_v')
                .select('*');

            if (fetchErr) throw fetchErr;
            
            const rows = (data || []) as MappingReadinessData[];
            const total = rows.length;
            const mapped = rows.filter(r => r.confirmed_mappings > 0).length;
            const unmapped = total - mapped;
            const pct = total > 0 ? Math.round((mapped / total) * 100) : 0;

            setReadiness({
                total_skus: total,
                mapped_skus: mapped,
                unmapped_skus: unmapped,
                mapping_percentage: pct
            });
        } catch (err: any) {
            console.error('Error fetching mapping readiness:', err);
            setError(err.message || 'Failed to load readiness');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReadiness();
    }, [fetchReadiness]);

    return { readiness, loading, error, refetch: fetchReadiness };
}

export function useSkuMappingQueue() {
    const [mappings, setMappings] = useState<SkuMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMappings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchErr } = await supabase
                .from('commerce_mapping_queue_v')
                .select('*')
                .in('mapping_status', ['suggested', 'review_required'])
                .order('confidence_score', { ascending: false })
                .order('last_validated_at', { ascending: false, nullsFirst: false });

            if (fetchErr) throw fetchErr;
            setMappings(data || []);
        } catch (err: any) {
            console.error('Error fetching mapping queue:', err);
            setError(err.message || 'Failed to load mapping queue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMappings();
    }, [fetchMappings]);

    return { mappings, loading, error, refetch: fetchMappings };
}

export function useConfirmSkuMapping() {
    const [isConfirming, setIsConfirming] = useState(false);

    const confirmMapping = async (mappingId: string): Promise<{ success: boolean; error?: string }> => {
        setIsConfirming(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('confirm_sku_mapping', {
                p_mapping_id: mappingId
            });

            if (rpcError) throw rpcError;
            
            if (data === true) {
                return { success: true };
            } else {
                return { success: false, error: 'RPC returned false or no data' };
            }
        } catch (err: any) {
            console.error('Confirmation failed:', err);
            return { success: false, error: err.message || 'Failed to confirm mapping' };
        } finally {
            setIsConfirming(false);
        }
    };

    return { confirmMapping, isConfirming };
}

export interface ChannelAccount {
    id: string;
    tenant_id: string;
    channel_name: string;
    connection_status: string;
    credentials_secret_id: string | null;
    credentials_metadata: any;
    health_status: string;
    last_error_at: string | null;
    last_synced_at: string | null;
    created_at: string;
    updated_at: string;
}

export function useChannelAccounts() {
    const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchErr } = await supabase
                .from('channel_accounts')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: true });

            if (fetchErr) throw fetchErr;
            setAccounts(data || []);
        } catch (err: any) {
            console.error('Error fetching channel accounts:', err);
            setError(err.message || 'Failed to load accounts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    return { accounts, loading, error, refetch: fetchAccounts };
}

export function useUpdateChannelMetadata() {
    const [isUpdating, setIsUpdating] = useState(false);

    const updateMetadata = async (channelAccountId: string, metadata: any): Promise<{ success: boolean; error?: string }> => {
        setIsUpdating(true);
        try {
            const { error: patchErr } = await supabase
                .from('channel_accounts')
                .update({ credentials_metadata: metadata, updated_at: new Date().toISOString() })
                .eq('id', channelAccountId);

            if (patchErr) throw patchErr;
            return { success: true };
        } catch (err: any) {
            console.error('Failed to update metadata:', err);
            return { success: false, error: err.message || 'Update failed' };
        } finally {
            setIsUpdating(false);
        }
    };

    return { updateMetadata, isUpdating };
}
