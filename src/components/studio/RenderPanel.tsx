import React, { useState } from 'react';
import { Plus, ChevronDown, Wand2, Palette, ImageIcon, ChevronLeft, ChevronRight, Info, MoreHorizontal } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { renderService } from '../../services/renderService';
import { getRenderStyles } from '../../services/ai/workflowRegistry';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface RenderPanelProps {
    height: number;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export const RenderPanel: React.FC<RenderPanelProps> = ({ height, collapsed, onCollapsedChange }) => {
    const {
        project,
        renderSettings,
        activeNodeId,
        setRenderPrompt,
        setRenderStyle,
        setRenderInfluence,
        setRenderNumImages,
        setRenderReferenceImage,
        addRenderResultGroup,
        setRendering,
        isRendering,
        setResultsPanelOpen
    } = useStore();

    const [showStyles, setShowStyles] = useState(false);
    const [showNumImagesDropdown, setShowNumImagesDropdown] = useState(false);
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCollapsed = collapsed ?? internalCollapsed;
    const setCollapsed = (nextCollapsed: boolean) => {
        onCollapsedChange?.(nextCollapsed);
        if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    };
    const [createMode, setCreateMode] = useState<'render' | 'refine'>('render');

    const availableStyles = getRenderStyles();
    const styleGroups = [
        { label: 'Essentials', styles: availableStyles.slice(0, 4) },
        { label: 'Stylized', styles: availableStyles.slice(4) },
    ];

    const handleGenerate = async () => {
        if (!renderSettings?.prompt?.trim()) return;
        setRendering(true);

        try {
            const canvasData = (window as any).getFlattenedCanvas ? (window as any).getFlattenedCanvas() : "";

            // Find workflow ID for the current style preset
            const selectedStyle = availableStyles.find(s => s.name === renderSettings.stylePreset);
            const workflowId = selectedStyle?.id;

            const response = await renderService.generate({
                ...renderSettings,
                workflowId, // Pass explicit ID if found
                init_image: canvasData,
                width: project.canvas.width,
                height: project.canvas.height
            });

            if (response.success && response.images.length > 0) {
                addRenderResultGroup(renderSettings, response.images, project.canvas.width, project.canvas.height, activeNodeId || undefined);
                setResultsPanelOpen(true);
            }

        } catch (error) {
            console.error("Generation failed", error);
        } finally {
            setRendering(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setRenderReferenceImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div 
            className="relative w-full flex flex-col bg-neutral-900 border border-neutral-800 rounded-[18px] shadow-2xl overflow-visible backdrop-blur-md bg-opacity-95 text-white pointer-events-auto flex-shrink-0"
            style={{ height: isCollapsed ? 40 : height }}
        >
            <header className="flex h-10 shrink-0 items-center justify-between rounded-t-[14px] bg-neutral-800 px-3">
                <button type="button" aria-expanded={!isCollapsed} aria-controls="studio-create-content" onClick={() => setCollapsed(!isCollapsed)} className="flex h-full min-w-0 items-center gap-2 text-left">
                    <ChevronDown size={14} className={`shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                    <h2 className="text-[11px] font-semibold">Create</h2>
                    <span className="rounded bg-neutral-700 px-1 py-0.5 text-[8px] font-semibold text-white/45">LEGACY</span>
                </button>
                <button type="button" aria-label="Create menu" className="flex h-10 w-10 items-center justify-center text-white/80 hover:text-white"><MoreHorizontal size={17} /></button>
            </header>

            {!isCollapsed && <div id="studio-create-content" className="flex min-h-0 flex-1 flex-col">
                <div role="group" aria-label="Create mode" className="grid shrink-0 grid-cols-2 rounded-xl bg-neutral-800 p-1 mx-3 my-2">
                    {(['render', 'refine'] as const).map((mode) => <button key={mode} type="button" aria-pressed={createMode === mode} onClick={() => setCreateMode(mode)} className={`min-h-9 rounded-lg text-[10px] font-medium capitalize transition ${createMode === mode ? 'bg-neutral-700 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}>{mode}</button>)}
                </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 custom-scrollbar">
                {/* Prompt Section */}
                <div className="space-y-2">
                    <div className="flex items-center justify-end gap-1 text-xs">
                        <button type="button" aria-label="Previous prompt suggestion" className="flex h-7 w-7 items-center justify-center text-white/45 hover:text-white"><ChevronLeft size={14} /></button>
                        <button type="button" aria-label="Next prompt suggestion" className="flex h-7 w-7 items-center justify-center text-white/45 hover:text-white"><ChevronRight size={14} /></button>
                        <button type="button" className="text-[11px] text-indigo-400 hover:text-indigo-300">Describe</button>
                    </div>
                    <textarea
                        aria-label="What are you creating?"
                        className="h-24 w-full resize-none rounded-lg bg-neutral-800 p-2 text-[11px] outline-none transition-all placeholder:text-white/35 focus:ring-1 focus:ring-indigo-400"
                        placeholder="What are you creating?"
                        value={renderSettings.prompt}
                        onChange={(e) => setRenderPrompt(e.target.value)}
                    />
                    <div className="flex items-center gap-1 text-white/60"><button type="button" aria-label="Add prompt reference" className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 hover:text-white"><ImageIcon size={14} /></button><button type="button" aria-label="Use microphone" className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 hover:text-white"><Wand2 size={14} /></button></div>
                </div>

                {/* Style Section */}
                <div className="relative space-y-2.5 border-t border-white/15 pt-3">
                    <div className="flex items-center gap-1 text-[11px] font-semibold"><span>Style</span><Info size={12} className="text-white/45" /></div>
                    <div className="relative">
                        <button
                            type="button"
                            aria-expanded={showStyles}
                            aria-label="Choose style workflow"
                            onClick={() => setShowStyles(!showStyles)}
                            className="flex min-h-12 w-full items-center justify-between rounded-lg bg-neutral-800 px-2 text-left transition-all hover:bg-neutral-700"
                        >
                            <span className="flex min-w-0 items-center gap-2"><span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-300 via-red-500 to-blue-500 text-white shadow-inner"><Palette size={16} /></span><span className="min-w-0"><span className="block truncate text-[11px] font-medium">{renderSettings.stylePreset}</span><span className="text-[9px] text-white/45">ComfyUI workflow</span></span></span>
                            <span className="rounded-lg bg-neutral-700 px-2 py-2 text-[10px] text-white/85">{Math.round(renderSettings.drawingInfluence * 100)}%</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-1 border-t border-white/15 pt-3 text-[11px] font-semibold">
                        <span>Reference</span><Info size={12} className="text-white/45" />
                    </div>
                    <div className="relative group">
                        {renderSettings.referenceImage ? (
                            <div className="relative w-full h-20 rounded-lg overflow-hidden border border-panel-border">
                                <img src={renderSettings.referenceImage} alt="Reference" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setRenderReferenceImage(undefined)}
                                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 hover:bg-red-500 transition-colors"
                                >
                                    <Plus size={14} className="rotate-45" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-lg bg-neutral-800 px-2 text-[11px] text-white/55 transition-all hover:bg-neutral-700">
                                <Plus size={14} />
                                Add...
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                        )}
                    </div>
                </div>

                {/* Influence Slider */}
                <div className="space-y-2.5 border-t border-white/15 pt-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span>Drawing Influence</span>
                        <span className="rounded-lg bg-neutral-800 px-2 py-1 text-[10px] text-white/85">{Math.round(renderSettings.drawingInfluence * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={renderSettings.drawingInfluence}
                        onChange={(e) => setRenderInfluence(parseFloat(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-indigo-500 accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] opacity-30 font-bold">
                        <span>Abstract</span>
                        <span>Precise</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-white/45"><span>Color-Match <Info size={11} className="inline" /></span><input type="checkbox" disabled className="h-4 w-4" /></div>
                    <div className="flex items-center justify-between text-[10px] text-white/45"><span>Live Render</span><input type="checkbox" className="h-4 w-4 accent-indigo-500" /></div>
                </div>

            </div>

            {showStyles && (
                <div className="absolute right-full top-28 z-[80] mr-2 flex max-h-[calc(100vh-8rem)] w-[min(17rem,calc(100vw-3rem))] flex-col overflow-y-auto rounded-[14px] border border-neutral-800 bg-neutral-900 p-2 shadow-2xl custom-scrollbar">
                    <div className="flex items-center gap-1 border-b border-white/15 pb-2 text-[11px] font-semibold">Styles <Info size={11} className="text-white/45" /></div>
                    {styleGroups.map((group) => <div key={group.label} className="pt-2"><h3 className="mb-1 text-[10px] font-medium text-white/55">{group.label}</h3><div className="space-y-0.5">{group.styles.map((style, index) => <button key={style.id} type="button" aria-pressed={renderSettings.stylePreset === style.name} className={cn("flex min-h-10 w-full items-center gap-2 rounded-lg px-1 text-left transition hover:bg-neutral-800", renderSettings.stylePreset === style.name && "bg-neutral-800")} onClick={() => { setRenderStyle(style.name); setShowStyles(false); }}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white shadow-inner ${['bg-gradient-to-br from-amber-300 via-red-500 to-blue-500', 'bg-gradient-to-br from-white via-neutral-400 to-neutral-700', 'bg-gradient-to-br from-neutral-100 via-neutral-300 to-white', 'bg-gradient-to-br from-rose-300 via-cyan-400 to-sky-500', 'bg-gradient-to-br from-cyan-300 via-yellow-400 to-neutral-700', 'bg-gradient-to-br from-orange-300 via-red-600 to-neutral-800', 'bg-gradient-to-br from-neutral-300 via-slate-600 to-neutral-900'][index % 7]}`}><Palette size={13} /></span><span className="min-w-0 flex-1 truncate text-[10px] font-medium">{style.name}</span>{index < 3 && <span className="rounded bg-neutral-700 px-1 py-0.5 text-[8px] text-white/45">V2</span>}<MoreHorizontal size={13} className="shrink-0 text-white/65" /></button>)}</div></div>)}
                </div>
            )}

            {/* Generate Button Wrapper */}
            <div className="mt-auto flex shrink-0 gap-2 p-2">
                <div className="relative">
                    <button
                        onClick={() => setShowNumImagesDropdown(!showNumImagesDropdown)}
                        disabled={isRendering}
                        title="Number of images to generate"
                        className={cn(
                            "min-h-10 min-w-14 rounded-lg bg-neutral-800 px-2.5 transition-all flex items-center justify-between gap-1 group",
                            isRendering ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-800"
                        )}
                    >
                        <span className="text-[13px] font-mono font-bold text-white">{renderSettings.numImages}</span>
                        <ChevronDown size={13} className={cn("opacity-40 group-hover:opacity-100 transition-transform", showNumImagesDropdown && "rotate-180")} />
                    </button>

                    {showNumImagesDropdown && (
                        <div className="absolute bottom-full left-0 mb-2 bg-neutral-900 border border-panel-border rounded-lg shadow-xl z-50 overflow-hidden py-1 min-w-[60px]">
                            <div className="px-3 py-1.5 text-[10px] font-bold opacity-30 border-b border-panel-border mb-1">COUNT</div>
                            {[1, 2, 3, 4].map(n => (
                                <button
                                    key={n}
                                    className={cn(
                                        "w-full px-4 py-2 text-center text-sm font-mono hover:bg-primary/20 hover:text-primary transition-colors",
                                        renderSettings.numImages === n ? "text-primary font-bold bg-primary/10" : "text-white/60"
                                    )}
                                    onClick={() => {
                                        setRenderNumImages(n);
                                        setShowNumImagesDropdown(false);
                                    }}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isRendering || !renderSettings?.prompt?.trim()}
                    className={cn(
                        "min-h-10 flex-1 rounded-lg bg-indigo-500 text-[13px] font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition-all relative overflow-hidden group hover:bg-indigo-400",
                        isRendering
                            ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                            : "bg-gradient-to-r from-primary to-primary-dark text-white shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
                    )}
                >
                    {isRendering ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-600 border-t-neutral-400" />
                            GENERATING...
                        </>
                    ) : (
                        <>
                            <Wand2 size={15} className="group-hover:rotate-12 transition-transform" />
                            GENERATE
                        </>
                    )}
                    {isRendering && (
                        <div className="absolute inset-0 bg-white/5 animate-pulse" />
                    )}
                </button>
            </div>
            </div>}
        </div>
    );
};
