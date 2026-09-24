import React, { useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';

interface StudioPanelFrameProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export const StudioPanelFrame: React.FC<StudioPanelFrameProps> = ({ title, children, className = '', collapsed, onCollapsedChange }) => {
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCollapsed = collapsed ?? internalCollapsed;
    const panelId = `studio-panel-${title.toLowerCase()}`;
    const setCollapsed = (nextCollapsed: boolean) => {
        onCollapsedChange?.(nextCollapsed);
        if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    };

    return (
        <section className={`flex h-full min-h-0 w-full max-h-full flex-col overflow-hidden rounded-[14px] bg-neutral-900 text-white shadow-2xl ${className}`} aria-labelledby={panelId}>
            <header className="flex h-10 shrink-0 items-center justify-between bg-neutral-800 px-3">
                <button type="button" aria-expanded={!isCollapsed} aria-controls={`${panelId}-content`} onClick={() => setCollapsed(!isCollapsed)} className="flex h-full min-w-0 items-center gap-2 text-left">
                    <ChevronDown size={14} className={`shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                    <h2 id={panelId} className="truncate text-[11px] font-semibold">{title}</h2>
                </button>
                <button type="button" className="flex min-h-10 min-w-10 items-center justify-center text-white/80 transition hover:text-white" aria-label={`${title} menu`}>
                    <MoreHorizontal size={17} aria-hidden="true" />
                </button>
            </header>
            {!isCollapsed && <div id={`${panelId}-content`} className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>}
        </section>
    );
};