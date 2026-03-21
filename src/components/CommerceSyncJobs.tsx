import React from 'react';
import { useFailedSyncJobs, SyncJob } from '../api/commerceHooks';
import { DataTable } from './ui/DataTable';
import { StatusBadge } from './ui/StatusBadge';
import { RefreshCw } from 'lucide-react';

export const CommerceSyncJobs: React.FC = () => {
    const { jobs, loading, error, refetch } = useFailedSyncJobs();

    const columns = [
        { header: 'Job ID', accessorKey: (row: SyncJob) => <span className="text-[0.65rem] font-mono text-content-3">{row.id}</span> },
        { header: 'Target Channel', accessorKey: (row: SyncJob) => <span className="font-semibold">{row.channel_name || 'Unknown'}</span> },
        { header: 'Process', accessorKey: (row: SyncJob) => row.job_type },
        { header: 'Enqueued', accessorKey: (row: SyncJob) => new Date(row.created_at).toLocaleString() },
        { header: 'Status', accessorKey: (row: SyncJob) => <StatusBadge text={row.status} variant="red" /> },
        {
            header: 'Terminal Error',
            accessorKey: (row: SyncJob) => (
                <div className="max-w-md truncate text-danger" title={row.last_error || ''}>
                    {row.last_error || 'No error captured'}
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* Header / Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[0.95rem] font-extrabold text-content">Outbound Sync Failures</h3>
                    <p className="text-[0.75rem] text-content-3 mt-0.5">Terminal dispatches caught by the Edge worker requiring API triage.</p>
                </div>

                <div className="flex items-center gap-3">
                    <StatusBadge text={`${jobs.length} failures`} variant={jobs.length > 0 ? 'red' : 'green'} />

                    <button
                        onClick={refetch}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-surface-bg-2 border border-border rounded-[8px] text-content-2 hover:text-content transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-[12px] text-sm text-danger">
                    Error loading sync jobs: {error}
                </div>
            )}

            {/* Datagrid */}
            <div className="flex-1 min-h-[300px] opacity-100 transition-opacity duration-200" style={{ opacity: loading && !jobs.length ? 0.5 : 1 }}>
                <DataTable
                    data={jobs}
                    columns={columns}
                />
            </div>
        </div>
    );
};
