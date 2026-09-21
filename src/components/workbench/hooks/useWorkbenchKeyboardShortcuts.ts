import { useEffect } from "react";
import { WorkbenchToolType } from "@/types";

type UseWorkbenchKeyboardShortcutsOptions = {
    copyToClipboard: () => void;
    pasteFromClipboard: (pos: { x: number; y: number }) => void;
    duplicateWorkbenchNode: () => void;
    removeWorkbenchNode: () => void;
    reorderWorkbenchNode: (id: string, direction: "front" | "back") => void;
    activeNodeId: string | null;
    selectedNodeIds: string[];
    getMousePosition: () => { x: number; y: number };
    screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
    setActiveWorkbenchTool: (tool: WorkbenchToolType) => void;
    undoWorkbench: () => void;
    redoWorkbench: () => void;
};

export function useWorkbenchKeyboardShortcuts({
    copyToClipboard,
    pasteFromClipboard,
    duplicateWorkbenchNode,
    removeWorkbenchNode,
    reorderWorkbenchNode,
    activeNodeId,
    selectedNodeIds,
    getMousePosition,
    screenToFlowPosition,
    setActiveWorkbenchTool,
    undoWorkbench,
    redoWorkbench,
}: UseWorkbenchKeyboardShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.target instanceof HTMLElement && e.target.isContentEditable) return;

            const isMod = e.ctrlKey || e.metaKey;

            if (isMod && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    redoWorkbench();
                } else {
                    undoWorkbench();
                }
            } else if (isMod && e.key.toLowerCase() === "y") {
                e.preventDefault();
                redoWorkbench();
            } else if (isMod && e.key === "c") {
                copyToClipboard();
            } else if (isMod && e.key === "v") {
                const mousePosition = getMousePosition();
                const pos = screenToFlowPosition({ x: mousePosition.x, y: mousePosition.y });
                pasteFromClipboard(pos);
            } else if (isMod && e.key === "d") {
                e.preventDefault();
                duplicateWorkbenchNode();
            } else if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedNodeIds.length > 0) {
                    removeWorkbenchNode();
                }
            } else if (e.key === "[") {
                if (activeNodeId) reorderWorkbenchNode(activeNodeId, "back");
            } else if (e.key === "]") {
                if (activeNodeId) reorderWorkbenchNode(activeNodeId, "front");
            } else if (!isMod) {
                const key = e.key.toLowerCase();
                const shortcutMap: Record<string, WorkbenchToolType> = {
                    v: "select",
                    h: "hand",
                    d: "draw",
                    e: "eraser",
                    a: "arrow",
                    t: "text",
                    n: "note",
                    m: "media",
                };

                const tool = shortcutMap[key];
                if (tool) {
                    e.preventDefault();
                    setActiveWorkbenchTool(tool);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode,
        reorderWorkbenchNode,
        activeNodeId,
        selectedNodeIds,
        getMousePosition,
        screenToFlowPosition,
        setActiveWorkbenchTool,
        undoWorkbench,
        redoWorkbench,
    ]);
}
