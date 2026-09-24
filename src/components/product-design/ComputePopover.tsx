import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { ModelTierBadge } from './ModelTierBadge';

interface ComputePopoverProps {
    target: string;
    tier: string;
    onOpenSettings: () => void;
}

export const ComputePopover: React.FC<ComputePopoverProps> = ({ target, tier, onOpenSettings }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button type="button" aria-label="Compute details" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white/90 px-2.5 py-1.5 text-xs text-zinc-700 shadow-lg backdrop-blur hover:bg-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Compute <ChevronDown size={12} />
            </button>
            {open && <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-700 shadow-2xl">
                <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">Compute target</p><ModelTierBadge tier={tier} /></div>
                <p className="rounded-xl bg-zinc-50 p-2.5 text-sm">{target}</p>
                <p className="mt-2 text-[10px] text-zinc-500">Automatic model selection uses available VRAM and workflow dependencies.</p>
                <button type="button" onClick={onOpenSettings} className="mt-3 flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium hover:bg-zinc-50"><span>Open AI &amp; Compute settings</span><ExternalLink size={12} /></button>
            </div>}
        </div>
    );
};
