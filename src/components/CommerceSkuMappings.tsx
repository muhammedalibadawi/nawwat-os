import React from 'react';
import { useMappingReadiness, useSkuMappingQueue, useConfirmSkuMapping, SkuMapping } from '../api/commerceHooks';
import { DataTable } from './ui/DataTable';
import { StatusBadge } from './ui/StatusBadge';
import { ActionButton } from './ui/ActionButton';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

export const CommerceSkuMappings: React.FC = () => {
    const { readiness, loading: readinessLoading, refetch: refetchReadiness } = useMappingReadiness();
    const { mappings, loading: queueLoading, error, refetch: refetchQueue } = useSkuMappingQueue();
    const { confirmMapping, isConfirming } = useConfirmSkuMapping();

    const handleRefresh = () => {
        refetchReadiness();
        refetchQueue();
    };

    const handleConfirm = async (mappingId: string) => {
        if (isConfirming) return;
        
        if (!window.confirm("Approve this mapping and allow inventory/order sync for this SKU on this channel?")) {
            return;
        }

        const result = await confirmMapping(mappingId);
        if (result.success) {
            handleRefresh();
        } else {
            alert(`Confirmation failed: ${result.error}`);
        }
    };

    const columns = [
        { header: 'NawwatOS SKU', accessorKey: (row: SkuMapping) => <span className="font-semibold text-content">{row.sku}</span> },
        { header: 'Channel', accessorKey: (row: SkuMapping) => <span className="font-medium text-content-2">{row.channel_name}</span> },
        { header: 'External Variant ID', accessorKey: (row: SkuMapping) => <span className="text-[0.65rem] font-mono text-content-3">{row.external_variant_id}</span> },
        { 
            header: 'Score', 
            accessorKey: (row: SkuMapping) => {
                const isHigh = row.confidence_score >= 80;
                return (
                    <div className={`flex items-center gap-1.5 text-[0.75rem] font-bold ${isHigh ? 'text-success' : 'text-warn'}`}>
                        {isHigh ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        {row.confidence_score}%
                    </div>
                );
            }
        },
        { header: 'Status', accessorKey: (row: SkuMapping) => <StatusBadge text={row.mapping_status} variant={row.mapping_status === 'suggested' ? 'purple' : 'warn'} /> },
        { header: 'Validated At', accessorKey: (row: SkuMapping) => row.last_validated_at ? new Date(row.last_validated_at).toLocaleString() : '-' },
        {
            header: 'Actions',
            accessorKey: (row: SkuMapping) => (
                <div className="w-32">
                    <ActionButton
                        icon={<CheckCircle size={16} />}
                        title="Approve"
                        subtitle="Confirm map"
                        onClick={() => handleConfirm(row.mapping_id)}
                    />
                </div>
            )
        }
    ];

    const isLoading = queueLoading || readinessLoading;

    return (
        <div className="flex flex-col gap-6">
            {/* KPI Cards / Readiness Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface-bg-2 border border-border rounded-[14px] p-5 flex flex-col justify-between">
                    <div className="text-[0.7rem] font-extrabold text-content-3 uppercase tracking-widest">Total SKUs</div>
                    <div className="text-[1.8rem] font-extrabold text-content mt-1">
                        {readiness?.total_skus || 0}
                    </div>
                </div>
                <div className="bg-surface-bg-2 border border-border rounded-[14px] p-5 flex flex-col justify-between">
                    <div className="text-[0.7rem] font-extrabold text-content-3 uppercase tracking-widest">Unmapped / Pending</div>
                    <div className="text-[1.8rem] font-extrabold text-orange mt-1">
                        {readiness?.unmapped_skus || 0}
                    </div>
                </div>
                <div className="bg-surface-bg-2 border border-border rounded-[14px] p-5 flex flex-col justify-between">
                    <div className="text-[0.7rem] font-extrabold text-content-3 uppercase tracking-widest">Mapping Coverage</div>
                    <div className="text-[1.8rem] font-extrabold text-success mt-1">
                        {readiness?.mapping_percentage || 0}%
                    </div>
                </div>
            </div>

            {/* Header / Actions */}
            <div className="flex items-center justify-between mt-2">
                <div>
                    <h3 className="text-[0.95rem] font-extrabold text-content">Approval Queue</h3>
                    <p className="text-[0.75rem] text-content-3 mt-0.5">Review and confirm suggested channel catalog mappings to enable sync.</p>
                </div>

                <div className="flex items-center gap-3">
                    <StatusBadge text={`${mappings.length} items queued`} variant={mappings.length > 0 ? 'purple' : 'green'} />

                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-surface-bg-2 border border-border rounded-[8px] text-content-2 hover:text-content transition-colors"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-[12px] text-sm text-danger">
                    Error loading mapping queue: {error}
                </div>
            )}

            {/* Datagrid */}
            <div className="flex-1 min-h-[300px] opacity-100 transition-opacity duration-200" style={{ opacity: isLoading && !mappings.length ? 0.5 : 1 }}>
                <DataTable
                    data={mappings}
                    columns={columns}
                />
            </div>
        </div>
    );
};
