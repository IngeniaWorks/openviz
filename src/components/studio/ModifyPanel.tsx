import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ImageIcon, Mic, MoreHorizontal, Sparkles, Shuffle, Wand2 } from 'lucide-react';

interface ModifyPanelProps {
    height: number;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    referenceImage?: string;
    onGenerate?: (prompt: string) => void;
    onAction?: (action: ModifyAction) => void;
}

export type ModifyAction = 'instant-render' | 'new-view' | 'variate-form-and-color';

const actions: Array<{ id: ModifyAction; label: string; icon: React.ElementType }> = [
    { id: 'instant-render', label: 'Instant Render', icon: Sparkles },
    { id: 'new-view', label: 'New view', icon: Wand2 },
    { id: 'variate-form-and-color', label: 'Variate form and color', icon: Shuffle },
];

export const ModifyPanel: React.FC<ModifyPanelProps> = ({ height: _height, referenceImage, onGenerate, onAction, collapsed, onCollapsedChange }) => {
    const [prompt, setPrompt] = useState('');
    const [outputs, setOutputs] = useState(1);
    const [mode, setMode] = useState('Standard');
    const [selectedAction, setSelectedAction] = useState<ModifyAction | null>(null);
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCollapsed = collapsed ?? internalCollapsed;
    const setCollapsed = (nextCollapsed: boolean) => {
        onCollapsedChange?.(nextCollapsed);
        if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    };

    const handleAction = (action: ModifyAction) => {
        setSelectedAction(action);
        onAction?.(action);
        if (prompt.trim()) onGenerate?.(prompt.trim());
    };

    return (
        <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] bg-neutral-900 text-white shadow-2xl"
            onSubmit={(event) => {
                event.preventDefault();
                if (prompt.trim()) onGenerate?.(prompt.trim());
            }}
        >
            <header className="flex h-10 shrink-0 items-center justify-between rounded-t-[14px] bg-neutral-800 px-3">
                <button type="button" aria-expanded={!isCollapsed} aria-controls="studio-modify-content" onClick={() => setCollapsed(!isCollapsed)} className="flex h-full items-center gap-2 text-left">
                    <ChevronDown size={14} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                    <h2 className="text-[11px] font-semibold">Modify</h2>
                </button>
                <button type="button" aria-label="Modify menu" className="flex h-10 w-10 items-center justify-center text-white/80 hover:text-white"><MoreHorizontal size={17} aria-hidden="true" /></button>
            </header>
            {!isCollapsed && <div id="studio-modify-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 custom-scrollbar">
                <div className="rounded-xl bg-neutral-800 p-3">
                    <label htmlFor="studio-modify-prompt" className="sr-only">What are you creating?</label>
                    <textarea id="studio-modify-prompt" aria-label="Modify prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What are you creating?" className="min-h-16 w-full resize-none bg-transparent text-[11px] text-white outline-none placeholder:text-white/35" />
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <button type="button" aria-label="Add image reference" className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-700 text-white/70 hover:text-white"><ImageIcon size={18} /></button>
                            <button type="button" aria-label="Use microphone" className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-700 text-white/70 hover:text-white"><Mic size={18} /></button>
                        </div>
                        <button type="submit" aria-label="Generate" disabled={!prompt.trim()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"><ArrowRight size={19} /></button>
                    </div>
                </div>
                {referenceImage && <div className="mt-3 flex items-center gap-2 text-xs text-white/60"><img src={referenceImage} alt="Product reference" className="h-8 w-8 rounded object-cover" /><span>Selected product reference</span></div>}
                <div className="mt-5 flex items-center justify-between text-[11px]"><span>Outputs</span><button type="button" aria-label="Number of outputs" className="flex min-h-9 min-w-12 items-center justify-between rounded-lg bg-neutral-800 px-2" onClick={() => setOutputs((count) => count === 4 ? 1 : count + 1)}>{outputs}<ArrowRight size={12} className="rotate-90" /></button></div>
                <label htmlFor="studio-modify-mode" className="mt-4 flex items-center justify-between text-[11px]">Mode<select id="studio-modify-mode" value={mode} onChange={(event) => setMode(event.target.value)} className="min-h-9 rounded-lg bg-neutral-800 px-2 text-[10px] text-white outline-none"><option>Standard</option><option>Precise</option><option>Creative</option></select></label>
                <div className="my-6 h-px bg-white/15" />
                <div className="space-y-1" aria-label="Modify actions">
                    {actions.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={selectedAction === id} onClick={() => handleAction(id)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-[10px] text-white/85 transition ${selectedAction === id ? 'bg-indigo-500 text-white' : 'hover:bg-white/10'}`}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}
                </div>
            </div>}
        </form>
    );
};
