import React, { useState } from 'react';
import { useUpdateChannelMetadata, ChannelAccount } from '../api/commerceHooks';
import { X, Save, AlertCircle } from 'lucide-react';

interface ConfigureSallaModalProps {
    account: ChannelAccount;
    onClose: () => void;
    onSuccess: () => void;
}

export const ConfigureSallaModal: React.FC<ConfigureSallaModalProps> = ({ account, onClose, onSuccess }) => {
    // Treat credentials_metadata as an object
    const [metadata, setMetadata] = useState<any>(account.credentials_metadata || {});
    const { updateMetadata, isUpdating } = useUpdateChannelMetadata();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSave = async () => {
        setErrorMsg(null);
        const result = await updateMetadata(account.id, metadata);
        if (result.success) {
            onSuccess();
        } else {
            setErrorMsg(result.error || 'Failed to update metadata');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-surface-card border border-border rounded-[16px] shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-border bg-surface-bg-2">
                    <h2 className="text-[1.1rem] font-bold text-content flex items-center gap-2">
                        Configure <span className="capitalize">{account.channel_name}</span>
                    </h2>
                    <button onClick={onClose} className="text-content-3 hover:text-content transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    <div className="flex items-start gap-3 p-3.5 bg-purple/10 border border-purple/20 rounded-[10px] text-purple">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <p className="text-[0.8rem] leading-relaxed">
                            <strong>Security Policy:</strong> Raw API secrets must be configured securely via the backend Edge Worker or CLI Vault. This UI exclusively supports safe non-secret connection metadata.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[0.8rem] font-bold text-content-2">Merchant ID</label>
                        <input
                            type="text"
                            value={metadata.merchant_id || ''}
                            onChange={(e) => setMetadata({ ...metadata, merchant_id: e.target.value })}
                            placeholder="e.g. 123456789 (Public reference)"
                            className="w-full bg-surface-bg border border-border rounded-[8px] px-3 py-2.5 text-[0.85rem] text-content outline-none focus:border-purple transition-colors placeholder-content-3/40"
                        />
                        <p className="text-[0.7rem] text-content-3">The public identifier resolving inbound webhooks to this tenant account.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[0.8rem] font-bold text-content-2">Shop URL</label>
                        <input
                            type="text"
                            value={metadata.shop_url || ''}
                            onChange={(e) => setMetadata({ ...metadata, shop_url: e.target.value })}
                            placeholder="https://salla.sa/..."
                            className="w-full bg-surface-bg border border-border rounded-[8px] px-3 py-2.5 text-[0.85rem] text-content outline-none focus:border-purple transition-colors placeholder-content-3/40"
                        />
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-danger/10 text-danger border border-danger/20 rounded-[8px] text-[0.8rem] animate-fade-in">
                            {errorMsg}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-border bg-surface-bg-2 flex justify-end gap-3 rounded-b-[16px]">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-[8px] text-[0.85rem] font-bold text-content-2 hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="flex items-center gap-2 px-5 py-2 rounded-[8px] text-[0.85rem] font-bold bg-purple text-white hover:bg-purple-hover transition-colors disabled:opacity-50"
                    >
                        <Save size={16} />
                        {isUpdating ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
};
