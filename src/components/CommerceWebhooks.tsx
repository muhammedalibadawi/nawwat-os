import React, { useState } from 'react';
import { useWebhooks, useRetryWebhook, WebhookEvent } from '../api/commerceHooks';
import { DataTable } from './ui/DataTable';
import { StatusBadge } from './ui/StatusBadge';
import { ActionButton } from './ui/ActionButton';
import { RefreshCw, RotateCcw } from 'lucide-react';

export const CommerceWebhooks: React.FC = () => {
    const { pending, failed, loading, error, refetch } = useWebhooks();
    const { retryWebhook, isRetrying } = useRetryWebhook();
    const [activeTab, setActiveTab] = useState<'pending' | 'failed'>('failed');

    const handleRetry = async (eventId: string) => {
        if (isRetrying) return;
        const result = await retryWebhook(eventId);
        if (result.success) {
            refetch(); // Only refreshes the webhooks query, per MVP constraints
        } else {
            alert(`Retry failed: ${result.error}`);
        }
    };

    const pendingColumns = [
        { header: 'Channel', accessorKey: (row: WebhookEvent) => <span className="font-semibold">{row.channel_name}</span> },
        { header: 'Event Type', accessorKey: (row: WebhookEvent) => row.event_type },
        { header: 'Source ID', accessorKey: (row: WebhookEvent) => row.source_event_id || '-' },
        { header: 'Status', accessorKey: (row: WebhookEvent) => <StatusBadge text={row.status} variant={row.status === 'retrying' ? 'warn' : 'cyan'} /> },
        { header: 'Created', accessorKey: (row: WebhookEvent) => new Date(row.created_at).toLocaleString() },
    ];

    const failedColumns = [
        ...pendingColumns.slice(0, 3), // Channel, Event, Source ID
        {
            header: 'Error',
            accessorKey: (row: WebhookEvent) => (
                <div className="max-w-xs truncate text-danger" title={row.error_message}>
                    {row.error_message || 'Unknown error'}
                </div>
            )
        },
        { header: 'Failed At', accessorKey: (row: WebhookEvent) => new Date(row.updated_at).toLocaleString() },
        {
            header: 'Actions',
            accessorKey: (row: WebhookEvent) => (
                <div className="w-32">
                    <ActionButton
                        icon={<RotateCcw size={16} />}
                        title="Retry"
                        subtitle="Queue again"
                        onClick={() => handleRetry(row.id)}
                    />
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* Header / Actions */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 p-1 bg-surface-bg-2 rounded-[12px] border border-border w-fit">
                    <button
                        onClick={() => setActiveTab('failed')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-[8px] transition-all ${activeTab === 'failed' ? 'bg-surface-card text-content shadow-sm' : 'text-content-3 hover:text-content'}`}
                    >
                        Failed ({failed.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-[8px] transition-all ${activeTab === 'pending' ? 'bg-surface-card text-content shadow-sm' : 'text-content-3 hover:text-content'}`}
                    >
                        Pending ({pending.length})
                    </button>
                </div>

                <button
                    onClick={refetch}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-surface-bg-2 border border-border rounded-[8px] text-content-2 hover:text-content transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-[12px] text-sm text-danger">
                    Error loading webhooks: {error}
                </div>
            )}

            {/* Datagrid */}
            <div className="flex-1 min-h-0 opacity-100 transition-opacity duration-200" style={{ opacity: loading && !pending.length && !failed.length ? 0.5 : 1 }}>
                <DataTable
                    data={activeTab === 'failed' ? failed : pending}
                    columns={activeTab === 'failed' ? failedColumns : pendingColumns}
                />
            </div>
        </div>
    );
};
