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
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl2 border border-viz-border bg-viz-panel text-white shadow-viz"
            onSubmit={(event) => {
                event.preventDefault();
                if (prompt.trim()) onGenerate?.(prompt.trim());
            }}
        >
            <header className="flex h-10 shrink-0 items-center justify-between px-3">
                <button type="button" aria-expanded={!isCollapsed} aria-controls="studio-modify-content" onClick={() => setCollapsed(!isCollapsed)} className="flex h-full items-center gap-2 text-left">
                    <ChevronDown size={14} strokeWidth={2} className={`text-viz-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                    <h2 className="text-xs font-semibold">Modify</h2>
                </button>
                <button type="button" aria-label="Modify menu" className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white"><MoreHorizontal size={16} aria-hidden="true" /></button>
            </header>
            {!isCollapsed && <div id="studio-modify-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 custom-scrollbar">
                <div className="rounded-lg border border-viz-border bg-viz-surface">
                    <label htmlFor="studio-modify-prompt" className="sr-only">What are you creating?</label>
                    <textarea id="studio-modify-prompt" aria-label="Modify prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What are you creating?" className="min-h-9 w-full resize-none bg-transparent p-2 text-xs text-white outline-none placeholder:text-white/35" />
                    <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex gap-1.5">
                            <button type="button" aria-label="Add image reference" className="flex h-6 w-6 items-center justify-center rounded-lg bg-viz-border text-viz-muted transition-colors hover:text-white"><ImageIcon size={12} /></button>
                            <button type="button" aria-label="Use microphone" className="flex h-6 w-6 items-center justify-center rounded-lg bg-viz-border text-viz-muted transition-colors hover:text-white"><Mic size={12} /></button>
                        </div>
                        <button type="submit" aria-label="Generate" disabled={!prompt.trim()} className="flex h-6 w-6 items-center justify-center rounded-lg bg-viz-accent text-white transition-colors hover:bg-viz-accent/80 disabled:cursor-not-allowed disabled:opacity-30"><ArrowRight size={16} /></button>
                    </div>
                </div>
                {referenceImage && <div className="mt-3 flex items-center gap-2 text-xs text-viz-muted"><img src={referenceImage} alt="Product reference" className="h-8 w-8 rounded object-cover" /><span>Selected product reference</span></div>}
                <label htmlFor="studio-modify-outputs" className="mt-4 flex items-center justify-between text-xs"><span className="text-white/90">Outputs</span><select id="studio-modify-outputs" value={outputs} onChange={(event) => setOutputs(Number(event.target.value))} className="h-8 rounded-lg bg-viz-surface px-3 text-xs font-medium text-white outline-none"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
                <label htmlFor="studio-modify-mode" className="mt-3 flex items-center justify-between text-xs"><span className="text-white/90">Mode</span><select id="studio-modify-mode" value={mode} onChange={(event) => setMode(event.target.value)} className="h-8 rounded-lg bg-viz-surface px-3 text-xs font-medium text-white outline-none"><option>Standard</option><option>Precise</option><option>Creative</option></select></label>
                <div className="my-5 h-px bg-white/10" />
                <div className="space-y-0.5" aria-label="Modify actions">
                    {actions.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={selectedAction === id} onClick={() => handleAction(id)} className={`flex min-h-9 w-full items-center gap-3 rounded-lg px-2 text-left text-xs transition-colors ${selectedAction === id ? 'bg-viz-accent text-white' : 'text-white/85 hover:bg-white/10'}`}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}
                </div>
            </div>}
        </form>
    );
};
