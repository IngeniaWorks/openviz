import { useReactFlow } from '@xyflow/react';

import { sketchFormats, useWorkbenchFormatMenu } from './useWorkbenchFormatMenu';
import { useWorkbenchKeyboardShortcuts } from './useWorkbenchKeyboardShortcuts';
import { useWorkbenchStore } from './useWorkbenchStore';
import { useWorkbenchPointerTracking } from './useWorkbenchPointerTracking';
import { useWorkbenchConnectionHandlers } from './useWorkbenchConnectionHandlers';
import { useWorkbenchBlockCreation } from './useWorkbenchBlockCreation';
import { useWorkbenchNodeHandlers } from './useWorkbenchNodeHandlers';

/**
 * Optional undo/redo routing (collaboration mode): when a shared session is
 * active the toolbar and keyboard shortcuts must drive the Yjs UndoManager
 * instead of the local store history.
 */
export interface UseWorkbenchOptions {
    undoAction?: () => void;
    redoAction?: () => void;
}

export const useWorkbench = (options?: UseWorkbenchOptions) => {
    const {
        workbenchNodes,
        connections,
        canUndoWorkbench,
        canRedoWorkbench,
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        beginWorkbenchGesture,
        commitWorkbenchGesture,
        cancelWorkbenchGesture,
        addWorkbenchNode,
        createOneShotNode,
        removeWorkbenchNode,
        duplicateWorkbenchNode,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        openNodeInStudio,
        activeNodeId,
        setActiveNodeId,
        selectedNodeIds,
        setSelectedNodeIds,
        addConnection,
        createSketchWithFormat,
        isDrawMode,
        activeWorkbenchTool,
        setDrawMode,
        toggleDrawMode,
        setActiveWorkbenchTool,
        freehandColor,
        setFreehandColor,
        freehandStrokeWidth,
        setFreehandStrokeWidth,
        undoLastFreehandNode,
        undoWorkbench,
        redoWorkbench,
    } = useWorkbenchStore();

    const { showFormatDropdown, setShowFormatDropdown, dropdownRef, handleFormatSelect } =
        useWorkbenchFormatMenu({ createSketchWithFormat });

    const { basicBlocksMenu, setBasicBlocksMenu, handleBlockSelect } = useWorkbenchBlockCreation({
        workbenchNodes,
        addWorkbenchNode,
        addConnection,
    });

    const {
        contextMenu,
        setContextMenu,
        handleNodesChange,
        handleNodeDoubleClick,
        handleNodeContextMenu,
        handlePaneClick,
        handleSourceClick,
        handleResize,
        handleResizeEnd,
        handleTransientDataChange,
        handleGestureStart,
        handleGestureEnd,
        handleDataChange,
    } = useWorkbenchNodeHandlers({
        workbenchNodes,
        selectedNodeIds,
        setSelectedNodeIds,
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        beginWorkbenchGesture,
        commitWorkbenchGesture,
        cancelWorkbenchGesture,
        removeWorkbenchNode,
        openNodeInStudio,
        setActiveNodeId,
        setBasicBlocksMenu,
    });

    const { handleConnect, onConnectStart, onConnectEnd } = useWorkbenchConnectionHandlers({
        workbenchNodes,
        addConnection,
    });

    const { screenToFlowPosition } = useReactFlow();
    const { getMousePosition } = useWorkbenchPointerTracking();

    useWorkbenchKeyboardShortcuts({
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode,
        reorderWorkbenchNode,
        activeNodeId,
        selectedNodeIds,
        screenToFlowPosition,
        getMousePosition,
        setActiveWorkbenchTool,
        undoWorkbench: options?.undoAction ?? undoWorkbench,
        redoWorkbench: options?.redoAction ?? redoWorkbench,
    });

    return {
        state: {
            workbenchNodes,
            connections,
            canUndoWorkbench,
            canRedoWorkbench,
            activeNodeId,
            selectedNodeIds,
            isDrawMode,
            activeWorkbenchTool,
            freehandColor,
            freehandStrokeWidth,
        },
        menus: {
            contextMenu,
            setContextMenu,
            showFormatDropdown,
            setShowFormatDropdown,
            dropdownRef,
            basicBlocksMenu,
            sketchFormats,
        },
        handlers: {
            handleFormatSelect,
            handleNodesChange,
            handleConnect,
            onConnectStart,
            onConnectEnd,
            handleNodeDoubleClick,
            handleNodeContextMenu,
            handlePaneClick,
            handleSourceClick,
            handleBlockSelect,
            handleResize,
            handleResizeEnd,
            handleTransientDataChange,
            handleGestureStart,
            handleGestureEnd,
            handleDataChange,
        },
        gesture: {
            updateWorkbenchNodeTransient,
            beginWorkbenchGesture,
            commitWorkbenchGesture,
            cancelWorkbenchGesture,
        },
        actions: {
            reorderWorkbenchNode,
            copyToClipboard,
            pasteFromClipboard,
            duplicateWorkbenchNode,
            removeWorkbenchNode,
            setDrawMode,
            toggleDrawMode,
            setActiveWorkbenchTool,
            setActiveNodeId,
            setSelectedNodeIds,
            addWorkbenchNode,
            createOneShotNode,
            setFreehandColor,
            setFreehandStrokeWidth,
            undoLastFreehandNode,
            undoWorkbench,
            redoWorkbench,
        },
    };
};
