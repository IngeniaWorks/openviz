import React from 'react';
import { Box, CircleHelp, Cuboid, Layers3, MousePointer2, PanelsTopLeft, SlidersHorizontal, Sparkles, Shuffle } from 'lucide-react';
import type { StudioWorkflowTab } from './WorkflowTabs';

interface StudioToolRailProps {
    active: StudioWorkflowTab;
    onChange: (tab: StudioWorkflowTab) => void;
    activeUtility: StudioUtilityTab;
    onUtilityChange: (tab: StudioUtilityTab) => void;
}

export type StudioUtilityTab = 'layers' | 'assets' | 'objects' | 'help';

const tools: Array<{ id: StudioWorkflowTab; label: string; icon: React.ElementType }> = [
    { id: 'modify', label: 'Modify', icon: MousePointer2 },
    { id: 'variation', label: 'Variation', icon: Shuffle },
    { id: 'generate', label: 'Make 3D', icon: Cuboid },
    { id: 'legacy', label: 'Create (Legacy)', icon: PanelsTopLeft },
];

const utilityTools: Array<{ id: StudioUtilityTab; label: string; icon: React.ElementType }> = [
    { id: 'layers', label: 'Layers and library', icon: Layers3 },
    { id: 'assets', label: 'Assets', icon: Sparkles },
    { id: 'objects', label: 'Canvas objects', icon: Box },
];

export const StudioToolRail: React.FC<StudioToolRailProps> = ({ active, onChange, activeUtility, onUtilityChange }) => (
    <aside className="pointer-events-auto flex h-full w-11 shrink-0 flex-col items-center bg-[#080a0f] px-1 py-3 text-white" aria-label="Studio utility rail">
        <div className="flex flex-col items-center gap-2">
            {tools.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    type="button"
                    aria-label={label}
                    aria-pressed={active === id}
                    onClick={() => onChange(id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${active === id ? 'bg-indigo-500 text-white' : 'text-white/85 hover:bg-white/10'}`}
                >
                    <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                </button>
            ))}
        </div>
        <div className="my-4 h-px w-8 bg-white/20" />
        <div className="flex flex-col items-center gap-2">
            <button
                type="button"
                aria-label="Adjust"
                aria-pressed={active === 'adjust'}
                onClick={() => onChange('adjust')}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${active === 'adjust' ? 'bg-indigo-500 text-white' : 'text-white/85 hover:bg-white/10'}`}
            >
                <SlidersHorizontal size={20} strokeWidth={1.6} aria-hidden="true" />
            </button>
            {utilityTools.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-label={label} aria-pressed={activeUtility === id} onClick={() => onUtilityChange(id)} className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${activeUtility === id ? 'bg-white/15 text-white' : 'text-white/85 hover:bg-white/10'}`}>
                    <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                </button>
            ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-2">
            <button type="button" aria-label="Help" aria-pressed={activeUtility === 'help'} onClick={() => onUtilityChange('help')} className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${activeUtility === 'help' ? 'bg-white/15 text-white' : 'text-white/85 hover:bg-white/10'}`}>
                <CircleHelp size={19} strokeWidth={1.6} aria-hidden="true" />
            </button>
        </div>
    </aside>
);