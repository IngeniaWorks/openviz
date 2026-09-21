import React, { useState } from 'react';
import {
    ArrowUpRight,
    Eraser,
    Hand,
    ImagePlus,
    MousePointer2,
    PenLine,
    Plus,
    Redo2,
    Smartphone,
    StickyNote,
    Type,
    Undo2,
    Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ColorPicker } from '@/components/studio/ColorPicker';
import { WorkbenchToolType } from '@/types';

type SketchFormat = {
    label: string;
    width: number;
    height: number;
};

type WorkbenchToolbarProps = {
    activeTool: WorkbenchToolType;
    freehandColor: string;
    freehandStrokeWidth: number;
    onSelectTool: (tool: WorkbenchToolType) => void;
    onFreehandColorChange: (color: string) => void;
    onFreehandStrokeWidthChange: (strokeWidth: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onMediaUpload: () => void;
    onMediaUploadFromPhone: () => void;
    sketchFormats: SketchFormat[];
    onFormatSelect: (width: number, height: number) => void;
};

const clampStrokeWidth = (value: number, min = 1, max = 64): number => {
    if (Number.isNaN(value)) {
        return min;
    }

    return Math.min(Math.max(value, min), max);
};

const TOOL_CONFIG: Array<{ id: WorkbenchToolType; label: string; shortcut: string; icon: LucideIcon }> = [
    { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
    { id: 'hand', label: 'Hand', shortcut: 'H', icon: Hand },
    { id: 'draw', label: 'Draw', shortcut: 'D', icon: PenLine },
    { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
    { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowUpRight },
    { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
    { id: 'note', label: 'Note', shortcut: 'N', icon: StickyNote },
    { id: 'media', label: 'Media', shortcut: 'M', icon: ImagePlus },
];

export const WorkbenchToolbar: React.FC<WorkbenchToolbarProps> = ({
    activeTool,
    freehandColor,
    freehandStrokeWidth,
    onSelectTool,
    onFreehandColorChange,
    onFreehandStrokeWidthChange,
    onUndo,
    onRedo,
    onMediaUpload,
    onMediaUploadFromPhone,
    sketchFormats,
    onFormatSelect,
}) => {
    const [showColorMenu, setShowColorMenu] = useState(false);
    const [showMediaMenu, setShowMediaMenu] = useState(false);
    const [showCreateMenu, setShowCreateMenu] = useState(false);

    const closeMenus = () => {
        setShowColorMenu(false);
        setShowMediaMenu(false);
        setShowCreateMenu(false);
    };

    const isDrawTool = activeTool === 'draw';

    return (
        <div className="pointer-events-none flex flex-col items-center gap-2">
            {(showColorMenu || showMediaMenu || showCreateMenu) && (
                <button
                    type="button"
                    className="fixed inset-0 z-[30] cursor-default"
                    aria-label="Close toolbar menu"
                    onClick={closeMenus}
                />
            )}

            <div className="pointer-events-auto z-[40] flex items-center gap-0.5 rounded-2xl border border-panel-border bg-panel/90 p-1 shadow-2xl backdrop-blur-md">
                {TOOL_CONFIG.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = activeTool === tool.id;
                    const isMediaButton = tool.id === 'media';

                    return (
                        <div key={tool.id} className="relative flex items-center">
                            <button
                                type="button"
                                onClick={() => {
                                    onSelectTool(tool.id);
                                    if (tool.id === 'media') {
                                        setShowMediaMenu((current) => !current);
                                        setShowCreateMenu(false);
                                        setShowColorMenu(false);
                                    } else {
                                        setShowMediaMenu(false);
                                        setShowCreateMenu(false);
                                        if (tool.id !== 'draw') {
                                            setShowColorMenu(false);
                                        }
                                    }
                                }}
                                className={`group relative rounded-full p-1.5 transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-text-secondary hover:bg-neutral-800 hover:text-white'
                                }`}
                                title={`${tool.label} (${tool.shortcut})`}
                                aria-pressed={isActive}
                            >
                                <Icon size={16} strokeWidth={2.3} />
                            </button>

                            {isMediaButton && showMediaMenu && (
                                <div
                                    className="absolute left-1/2 top-full z-[50] mt-4 w-60 -translate-x-1/2 overflow-hidden rounded-xl border border-panel-border bg-panel shadow-2xl backdrop-blur-md"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onMediaUpload();
                                            setShowMediaMenu(false);
                                            setShowCreateMenu(false);
                                        }}
                                        className="flex w-full items-center gap-2 border-b border-panel-border px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-panel-light hover:text-white"
                                    >
                                        <Upload size={14} />
                                        Upload
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onMediaUploadFromPhone();
                                            setShowMediaMenu(false);
                                        }}
                                        className="flex w-full items-center gap-2 border-b border-panel-border px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-panel-light hover:text-white"
                                    >
                                        <Smartphone size={14} />
                                        Upload from phone
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateMenu((current) => !current)}
                                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-panel-light hover:text-white"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <Plus size={14} />
                                            Create new
                                        </span>
                                    </button>

                                    {showCreateMenu && (
                                        <div className="border-t border-panel-border">
                                            {sketchFormats.map((format) => (
                                                <button
                                                    key={format.label}
                                                    type="button"
                                                    onClick={() => {
                                                        onFormatSelect(format.width, format.height);
                                                        setShowMediaMenu(false);
                                                        setShowCreateMenu(false);
                                                    }}
                                                    className="flex w-full items-center justify-between border-b border-panel-border px-4 py-2.5 text-left text-text-secondary transition-colors last:border-b-0 hover:bg-panel-light hover:text-white"
                                                >
                                                    <span className="text-sm font-medium">{format.label}</span>
                                                    <span className="text-xs opacity-50">
                                                        {format.width}x{format.height}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="mx-0.5 h-5 w-px bg-panel-border" />
                <button
                    type="button"
                    onClick={onUndo}
                    className="rounded-full p-1.5 text-text-secondary transition-all hover:bg-neutral-800 hover:text-white"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={16} />
                </button>
                <button
                    type="button"
                    onClick={onRedo}
                    className="rounded-full p-1.5 text-text-secondary transition-all hover:bg-neutral-800 hover:text-white"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 size={16} />
                </button>
            </div>

            {isDrawTool && (
                <div className="pointer-events-auto z-[40] flex items-center gap-3 rounded-2xl border border-panel-border bg-panel/90 px-3 py-2 shadow-2xl backdrop-blur-md">
                    <span className="text-xs font-medium text-text-secondary">Thickness</span>
                    <input
                        type="range"
                        min={1}
                        max={64}
                        step={1}
                        value={freehandStrokeWidth}
                        onChange={(event) => onFreehandStrokeWidthChange(clampStrokeWidth(Number(event.target.value)))}
                        className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-neutral-800 accent-primary"
                        aria-label="Freehand thickness"
                    />
                    <div className="relative">
                        <button
                            type="button"
                            className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-panel-border p-0.5 shadow-inner transition-transform hover:scale-105 active:scale-95"
                            style={{ backgroundColor: freehandColor }}
                            onClick={() => setShowColorMenu((current) => !current)}
                            title="Change Color"
                        >
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent" />
                        </button>
                        {showColorMenu && (
                            <div
                                className="absolute left-1/2 top-full z-[50] mt-4 -translate-x-1/2"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-panel-border bg-panel" />
                                <ColorPicker color={freehandColor} onChange={onFreehandColorChange} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
