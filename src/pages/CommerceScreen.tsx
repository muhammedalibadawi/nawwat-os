import React, { useState } from 'react';
import { CommerceWebhooks } from '../components/CommerceWebhooks';
import { CommerceSyncJobs } from '../components/CommerceSyncJobs';
import { CommerceSkuMappings } from '../components/CommerceSkuMappings';
import { CommerceChannels } from '../components/CommerceChannels';

const CommerceScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'ingress' | 'egress' | 'mappings' | 'channels'>('ingress');

    return (
        <div className="flex h-full w-full flex-col gap-6">

            <div>
                <h2 className="text-lg font-black text-white">التكامل الفني للقنوات</h2>
                <p className="mt-1 max-w-2xl text-[0.85rem] leading-relaxed text-content-3">
                    طابور ويبهوك وارد، مهام مزامنة صادرة، وتعيين SKU — ضمن CommerceOS (طبقة إيراد القنوات).
                </p>
            </div>

            {/* Module Picker / Navigation Surface */}
            <div className="flex items-center gap-[6px] p-[5px] bg-surface-bg-2 rounded-[14px] w-fit border border-border mt-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
                <button
                    onClick={() => setActiveTab('ingress')}
                    className={`flex items-center gap-2.5 px-[18px] py-[9px] rounded-[10px] text-[0.8rem] font-bold transition-all duration-300 ease-spring ${
                        activeTab === 'ingress' 
                            ? 'bg-surface-card text-cyan shadow-[0_2px_10px_rgba(0,0,0,0.18)] shadow-cyan/10 ring-1 ring-white/5' 
                            : 'text-content-3 hover:text-white/80 hover:bg-white/5'
                    }`}
                >
                    Inbound Webhooks
                </button>
                <button
                    onClick={() => setActiveTab('egress')}
                    className={`flex items-center gap-2.5 px-[18px] py-[9px] rounded-[10px] text-[0.8rem] font-bold transition-all duration-300 ease-spring ${
                        activeTab === 'egress' 
                            ? 'bg-surface-card text-orange shadow-[0_2px_10px_rgba(0,0,0,0.18)] shadow-orange/10 ring-1 ring-white/5' 
                            : 'text-content-3 hover:text-white/80 hover:bg-white/5'
                    }`}
                >
                    Outbound Sync Jobs
                </button>
                <button
                    onClick={() => setActiveTab('mappings')}
                    className={`flex items-center gap-2.5 px-[18px] py-[9px] rounded-[10px] text-[0.8rem] font-bold transition-all duration-300 ease-spring ${
                        activeTab === 'mappings' 
                            ? 'bg-surface-card text-purple shadow-[0_2px_10px_rgba(0,0,0,0.18)] shadow-purple/10 ring-1 ring-white/5' 
                            : 'text-content-3 hover:text-white/80 hover:bg-white/5'
                    }`}
                >
                    SKU Mappings
                </button>
                <button
                    onClick={() => setActiveTab('channels')}
                    className={`flex items-center gap-2.5 px-[18px] py-[9px] rounded-[10px] text-[0.8rem] font-bold transition-all duration-300 ease-spring ${
                        activeTab === 'channels' 
                            ? 'bg-surface-card text-emerald shadow-[0_2px_10px_rgba(0,0,0,0.18)] shadow-emerald/10 ring-1 ring-white/5' 
                            : 'text-content-3 hover:text-white/80 hover:bg-white/5'
                    }`}
                >
                    Channels
                </button>
            </div>

            {/* Active Rendered Surface */}
            <div className="flex-1 mt-2">
                {activeTab === 'ingress' && <CommerceWebhooks />}
                {activeTab === 'egress' && <CommerceSyncJobs />}
                {activeTab === 'mappings' && <CommerceSkuMappings />}
                {activeTab === 'channels' && <CommerceChannels />}
            </div>

        </div>
    );
};

export default CommerceScreen;
