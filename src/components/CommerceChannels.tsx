import React, { useState } from 'react';
import { useChannelAccounts, ChannelAccount } from '../api/commerceHooks';
import { DataTable } from './ui/DataTable';
import { StatusBadge } from './ui/StatusBadge';
import { ActionButton } from './ui/ActionButton';
import { ConfigureSallaModal } from './ConfigureSallaModal';
import { Settings, RefreshCw } from 'lucide-react';

export const CommerceChannels: React.FC = () => {
    const { accounts, loading, error, refetch } = useChannelAccounts();
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<ChannelAccount | null>(null);

    const handleConfigure = (account: ChannelAccount) => {
        setSelectedAccount(account);
        setConfigModalOpen(true);
    };

    const columns = [
        { 
            header: 'Channel Name', 
            accessorKey: (row: ChannelAccount) => (
                <div className="flex items-center gap-2">
                    <span className="font-extrabold text-content capitalize">{row.channel_name}</span>
                    <span className="text-[0.65rem] text-content-3 font-mono tracking-widest bg-surface-bg-2 px-1.5 py-0.5 rounded-[4px] border border-border">
                        {row.id.split('-')[0]}
                    </span>
                </div>
            ) 
        },
        { 
            header: 'Connection Status', 
            accessorKey: (row: ChannelAccount) => (
                <StatusBadge 
                    text={row.connection_status} 
                    variant={row.connection_status === 'connected' ? 'green' : (row.connection_status === 'disconnected' ? 'gray' : 'warn')} 
                />
            ) 
        },
        { 
            header: 'Health', 
            accessorKey: (row: ChannelAccount) => (
                <StatusBadge 
                    text={row.health_status} 
                    variant={row.health_status === 'healthy' ? 'green' : 'warn'} 
                />
            ) 
        },
        { 
            header: 'Last Synced', 
            accessorKey: (row: ChannelAccount) => row.last_synced_at ? new Date(row.last_synced_at).toLocaleString() : 'Never' 
        },
        {
            header: 'Actions',
            accessorKey: (row: ChannelAccount) => (
                <div className="w-32">
                    <ActionButton
                        icon={<Settings size={16} />}
                        title="Configure"
                        subtitle="Metadata"
                        onClick={() => handleConfigure(row)}
                    />
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6 w-full animate-fade-in">
            {/* Header / Actions */}
            <div className="flex items-center justify-between mt-2">
                <div>
                    <h3 className="text-[0.95rem] font-extrabold text-content">Connected Channels</h3>
                    <p className="text-[0.75rem] text-content-3 mt-0.5">Manage external integrations and safe metadata configurations.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={refetch}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-surface-bg-2 border border-border rounded-[8px] text-content-2 hover:text-content transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    {/* Add Channel button is currently out of MVP scope */}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-[12px] text-sm text-danger animate-fade-in">
                    Error loading channels: {error}
                </div>
            )}

            {/* Datagrid */}
            <div className="flex-1 min-h-[300px] opacity-100 transition-opacity duration-200" style={{ opacity: loading && !accounts.length ? 0.5 : 1 }}>
                <DataTable data={accounts} columns={columns} />
            </div>

            {/* Config Modal */}
            {configModalOpen && selectedAccount && (
                <ConfigureSallaModal 
                    account={selectedAccount} 
                    onClose={() => setConfigModalOpen(false)} 
                    onSuccess={() => {
                        setConfigModalOpen(false);
                        refetch();
                    }}
                />
            )}
        </div>
    );
};
