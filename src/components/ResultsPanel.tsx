import React from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, MoreHorizontal, RotateCcw, Eye, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ResultsPanel: React.FC = () => {
    const {
        renderResults,
        resultsPanelOpen,
        setResultsPanelOpen,
        previewingRender,
        setPreviewingRender,
        addResultAsLayer,
        isRendering
    } = useStore();

    if (renderResults.length === 0 && !isRendering) return null;

    return (
        <div className={cn(
            "w-full flex-shrink flex flex-col bg-panel border border-panel-border rounded-panel shadow-2xl overflow-hidden backdrop-blur-md bg-opacity-95 text-white transition-all duration-300",
            !resultsPanelOpen ? "h-12" : "max-h-[40vh]"
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-panel-border"
                onClick={() => setResultsPanelOpen(!resultsPanelOpen)}
            >
                <div className="flex items-center gap-2">
                    <ChevronDown size={16} className={cn("transition-transform opacity-60", !resultsPanelOpen && "-rotate-90")} />
                    <span className="text-sm font-bold tracking-tight">Results</span>
                </div>
                <button className="p-1 hover:bg-white/10 rounded transition-colors opacity-60">
                    <MoreHorizontal size={16} />
                </button>
            </div>

            {/* Content Area */}
            {resultsPanelOpen && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {/* Rendering Status Placeholder */}
                        {isRendering && (
                            <div className="space-y-4 animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        Rendering...
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="aspect-square bg-neutral-800 rounded-lg" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Date Grouping */}
                        <div className="space-y-4">
                            {renderResults.length > 0 && <h3 className="text-sm font-bold opacity-90">Latest Renders</h3>}

                            {renderResults.map((group) => (
                                <div key={group.id} className="space-y-2">
                                    {/* Group Header/Tag */}
                                    <div className="flex items-center justify-between">
                                        <div className="bg-primary/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                            {group.style.includes('Modify') ? 'Modify' : 'Render'}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-40">
                                            <button className="p-1 hover:bg-white/10 rounded transition-colors">
                                                <RotateCcw size={14} />
                                            </button>
                                            <button className="p-1 hover:bg-white/10 rounded transition-colors">
                                                <MoreHorizontal size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Prompt Label */}
                                    <div className="text-[11px] font-medium opacity-40 lowercase">
                                        {group.prompt || 'art'}
                                    </div>

                                    {/* Image Grid */}
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {group.images.map((img, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setPreviewingRender(img)}
                                                className={cn(
                                                    "aspect-square rounded-lg overflow-hidden border-2 transition-all relative group/thumb",
                                                    previewingRender === img ? "border-primary shadow-lg shadow-primary/20" : "border-neutral-800 hover:border-white/20"
                                                )}
                                            >
                                                <img src={img} alt={`Result ${idx}`} className="w-full h-full object-cover" />
                                                {previewingRender === img && (
                                                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-panel-border flex items-center justify-between bg-black/20 mt-auto">
                        <div className="flex items-center gap-1.5">
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <Eye size={18} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <ArrowLeft size={18} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <ArrowRight size={18} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <Download size={18} />
                            </button>
                        </div>

                        <button
                            disabled={!previewingRender}
                            onClick={() => previewingRender && addResultAsLayer(previewingRender)}
                            className={cn(
                                "px-8 py-2.5 rounded-xl text-sm font-bold transition-all",
                                previewingRender
                                    ? "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
                                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                            )}
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


export default ResultsPanel;
