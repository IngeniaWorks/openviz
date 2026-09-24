import React, { useState } from 'react';
import { ImageIcon, Layers, Wand2 } from 'lucide-react';
import { cn } from '@/components/nodes/nodeUi';

interface ModifyPanelProps {
    height: number;
    referenceImage?: string;
    onGenerate?: (prompt: string) => void;
}

export const ModifyPanel: React.FC<ModifyPanelProps> = ({ height: _height, referenceImage, onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [preservation, setPreservation] = useState(0.78);
    const [mode, setMode] = useState('Product edit');

    return (
        <form
            className="flex h-full w-60 flex-col overflow-hidden rounded-panel border border-panel-border bg-panel text-white shadow-2xl backdrop-blur-md"
            onSubmit={(event) => {
                event.preventDefault();
                if (prompt.trim()) onGenerate?.(prompt.trim());
            }}
        >
            <div className="flex items-center gap-2 border-b border-panel-border p-3">
                <Wand2 size={16} className="text-primary" />
                <div><h2 className="text-sm font-bold">Modify</h2><p className="text-[10px] opacity-40">Preserve the product. Change one thing.</p></div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-3">
                <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Source</span>
                    <div className="flex items-center gap-2 rounded-lg border border-panel-border bg-neutral-900 p-2">
                        {referenceImage ? <img src={referenceImage} alt="Product reference" className="h-9 w-9 rounded object-cover" /> : <ImageIcon size={16} className="text-white/40" />}
                        <span className="truncate text-xs text-white/70">{referenceImage ? 'Selected product' : 'Open an image to modify'}</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <label htmlFor="studio-modify-prompt" className="text-[10px] font-bold uppercase tracking-wider opacity-60">Prompt</label>
                    <textarea id="studio-modify-prompt" aria-label="Modify prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Replace plastic with brushed aluminum..." className="min-h-24 w-full resize-none rounded-lg border border-panel-border bg-neutral-900 p-2 text-sm outline-none focus:border-primary" />
                    <p className="text-[10px] text-white/35">Use direct verbs. Say what should stay unchanged.</p>
                </div>
                <div className="space-y-2">
                    <label htmlFor="studio-modify-mode" className="text-[10px] font-bold uppercase tracking-wider opacity-60">Mode</label>
                    <select id="studio-modify-mode" value={mode} onChange={(event) => setMode(event.target.value)} className="w-full rounded-lg border border-panel-border bg-neutral-900 p-2 text-xs outline-none focus:border-primary">
                        <option>Product edit</option><option>Material &amp; color</option><option>Sketch to render</option><option>Background</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60"><label htmlFor="studio-preservation" className="flex items-center gap-1"><Layers size={11} /> Preserve structure</label><span className="font-mono text-primary">{Math.round(preservation * 100)}%</span></div>
                    <input id="studio-preservation" type="range" min="0" max="1" step="0.01" value={preservation} onChange={(event) => setPreservation(Number(event.target.value))} className="h-1.5 w-full accent-primary" />
                </div>
                <div className="flex flex-wrap gap-1.5"><span className="rounded bg-primary/15 px-2 py-1 text-[10px] text-primary">@1 source</span><button type="button" className="rounded border border-dashed border-panel-border px-2 py-1 text-[10px] opacity-50 hover:opacity-100">+ Reference</button></div>
            </div>
            <div className="border-t border-panel-border p-3"><button type="submit" disabled={!prompt.trim()} className={cn('flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition', prompt.trim() ? 'bg-primary text-white hover:bg-primary-dark' : 'cursor-not-allowed bg-neutral-800 text-white/30')}><Wand2 size={15} /> Generate</button><p className="mt-2 text-center text-[10px] opacity-30">⌘/Ctrl + Enter from the Workbench</p></div>
        </form>
    );
};
