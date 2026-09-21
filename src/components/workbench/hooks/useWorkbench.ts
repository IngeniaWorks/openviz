import { useReactFlow } from '@xyflow/react';

import { sketchFormats, useWorkbenchFormatMenu } from './useWorkbenchFormatMenu';
import { useWorkbenchKeyboardShortcuts } from './useWorkbenchKeyboardShortcuts';
import { useWorkbenchStore } from './useWorkbenchStore';
import { useWorkbenchPointerTracking } from './useWorkbenchPointerTracking';
import { useWorkbenchConnectionHandlers } from './useWorkbenchConnectionHandlers';
import { useWorkbenchBlockCreation } from './useWorkbenchBlockCreation';
import { useWorkbenchNodeHandlers } from './useWorkbenchNodeHandlers';

export const useWorkbench = () => {
    const {
        workbenchNodes,
        connections,
        updateWorkbenchNode,
        addWorkbenchNode,
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
        handleDataChange,
    } = useWorkbenchNodeHandlers({
        workbenchNodes,
        selectedNodeIds,
        setSelectedNodeIds,
        updateWorkbenchNode,
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
        undoWorkbench,
        redoWorkbench,
    });

    return {
        state: {
            workbenchNodes,
            connections,
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
            handleDataChange,
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
            setFreehandColor,
            setFreehandStrokeWidth,
            undoLastFreehandNode,
            undoWorkbench,
            redoWorkbench,
        },
    };
};
