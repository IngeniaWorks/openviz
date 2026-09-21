import React, { useCallback, useRef } from 'react';
import {
    ReactFlow,
    Background,
    NodeTypes,
    EdgeTypes,
    BackgroundVariant,
    ReactFlowProvider,
    useReactFlow,
    useViewport,
    SelectionMode,
    OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ImageNode } from '../nodes/ImageNode';
import { VideoNode } from '../nodes/VideoNode';
import { AnimateNode } from '../nodes/AnimateNode';
import { RenderNode } from '../nodes/RenderNode';
import { FreehandNode } from '../nodes/FreehandNode';
import { ArrowNode } from '../nodes/ArrowNode';
import { TextNode } from '../nodes/TextNode';
import { NoteNode } from '../nodes/NoteNode';
import { MediaNode } from '../nodes/MediaNode';
import { CustomEdge } from '../nodes/CustomEdge';
import { WorkbenchChrome } from './WorkbenchChrome';
import { useWorkbench } from './hooks/useWorkbench';
import { useStore } from '../../store/useStore';
import { useAutoSaveScene } from '../../hooks/useAutoSaveScene';
import { useWorkbenchCenterOnReturn } from './hooks/useWorkbenchCenterOnReturn';
import { useWorkbenchOneShotCreation } from './hooks/useWorkbenchOneShotCreation';
import { getFlowModeProps } from './hooks/workbenchModeProps';
import { useWorkbenchContextMenuActions } from './hooks/useWorkbenchContextMenuActions';
import { useWorkbenchFreehandEraser } from './hooks/useWorkbenchFreehandEraser';
import { useWorkbenchMediaUpload } from './hooks/useWorkbenchMediaUpload';
import { useResizeObserverWarningSuppression } from './hooks/useResizeObserverWarningSuppression';
import { useWorkbenchGraph } from './hooks/useWorkbenchGraph';
import { useSceneStream } from './hooks/useSceneStream';
import { useShallow } from 'zustand/react/shallow';
import { WorkbenchConnectionLine } from '../nodes/WorkbenchConnectionLine';
import { DrawingOverlay } from '@/drawing/DrawingOverlay';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';

const nodeTypes: NodeTypes = {
    imageNode: ImageNode,
    videoNode: VideoNode,
    animateNode: AnimateNode,
    renderNode: RenderNode,
    freehandNode: FreehandNode,
    arrowNode: ArrowNode,
    textNode: TextNode,
    noteNode: NoteNode,
    mediaNode: MediaNode,
};

const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

const WorkbenchContent: React.FC = () => {
    const flowWrapperRef = useRef<HTMLDivElement>(null);
    const { setCenter, zoomIn, zoomOut, fitView, setViewport, screenToFlowPosition } = useReactFlow();
    const { zoom } = useViewport();
    const { viewMode, currentProjectId, updateWorkbenchNode } = useStore(
        useShallow((state) => ({
            viewMode: state.viewMode,
            currentProjectId: state.currentProjectId,
            updateWorkbenchNode: state.updateWorkbenchNode,
        }))
    );
    
    useAutoSaveScene(currentProjectId);
    useSceneStream(currentProjectId);

    useResizeObserverWarningSuppression();

    const {
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
            setActiveWorkbenchTool,
            setActiveNodeId,
            setSelectedNodeIds,
            addWorkbenchNode,
            createOneShotNode,
            setFreehandColor,
            setFreehandStrokeWidth,
            undoWorkbench,
            redoWorkbench,
        },
    } = useWorkbench();
    useWorkbenchCenterOnReturn({ viewMode, activeNodeId, workbenchNodes, setCenter });
    const { nodes, edges } = useWorkbenchGraph({
        workbenchNodes,
        connections,
        selectedNodeIds,
        handleSourceClick,
        handleResize,
        handleDataChange,
    });

    const contextMenuActions = useWorkbenchContextMenuActions({
        contextMenu,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode,
    });

    // FR-007: one-shot creation is an atomic store action (T006) — the view
    // only builds the node payload; select + tool switch happen in one update.
    const { handlePaneClickWithTool, handleCanvasMouseDownForArrow, handleCanvasMouseUpForArrow } =
        useWorkbenchOneShotCreation({
            activeWorkbenchTool,
            screenToFlowPosition,
            createOneShotNode,
            handlePaneClick,
        });

    const { handleEraseAtPoint, onStrokeFinished, ERASER_SIZE } = useWorkbenchFreehandEraser({
        activeWorkbenchTool,
        workbenchNodes,
        freehandColor,
        freehandStrokeWidth,
        removeWorkbenchNode,
        addWorkbenchNode,
        setActiveNodeId,
        setSelectedNodeIds,
    });

    const {
        mediaUploadInputRef,
        isPhoneUploadModalOpen,
        closePhoneUploadModal,
        handleMediaUpload,
        handleMediaUploadFromPhone,
        handlePhoneUploadComplete,
        handleMediaUploadChange,
    } = useWorkbenchMediaUpload({
        flowWrapperRef,
        screenToFlowPosition,
        makeOneShotNode: createOneShotNode,
    });

    // When a node drag finishes (mouse released), persist the exact final position
    // and sync to the backend immediately so a reload never shows stale state.
    const handleNodeDragStop = useCallback<OnNodeDrag>(
        (_event, node) => {
            updateWorkbenchNode(node.id, { x: node.position.x, y: node.position.y });
            requestImmediateSceneSave();
        },
        [updateWorkbenchNode]
    );

    const isDrawModeActive = activeWorkbenchTool === 'draw';
    const isEraserModeActive = activeWorkbenchTool === 'eraser';
    // C-3.1/C-3.2: mode-derived React Flow props from the pure contract fn (T018).
    const flowModeProps = getFlowModeProps(activeWorkbenchTool);

    return (
        <div
            ref={flowWrapperRef}
            className="relative w-full h-screen bg-white"
            onMouseDown={handleCanvasMouseDownForArrow}
            onMouseUp={handleCanvasMouseUpForArrow}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChange}
                onNodeDragStop={handleNodeDragStop}
                onConnect={handleConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeContextMenu={handleNodeContextMenu}
                onPaneClick={handlePaneClickWithTool}
                deleteKeyCode={['Backspace', 'Delete']}
                selectionMode={SelectionMode.Partial}
                selectionOnDrag={flowModeProps.selectionOnDrag}
                selectionKeyCode="Shift"
                multiSelectionKeyCode={['Meta', 'Control']}
                panOnDrag={flowModeProps.panOnDrag}
                elementsSelectable={flowModeProps.elementsSelectable}
                nodesDraggable={flowModeProps.nodesDraggable}
                nodesConnectable={flowModeProps.nodesConnectable}
                snapToGrid={true}
                snapGrid={[5, 5]}
                fitView
                minZoom={0.1}
                maxZoom={2}
                connectionRadius={60}
                connectionLineComponent={WorkbenchConnectionLine}
            >
                <Background id='smalldots' variant={BackgroundVariant.Dots} gap={12} size={1} color="#c6cfdb" />
                <Background id="fatdots" color="#a0afc3" variant={BackgroundVariant.Dots} gap={56} size={1.1} />
            </ReactFlow>
            <DrawingOverlay
                mode={isEraserModeActive ? 'erase' : isDrawModeActive || isDrawMode ? 'draw' : null}
                wrapperRef={flowWrapperRef}
                previewColor={freehandColor}
                previewSize={freehandStrokeWidth}
                eraserSize={ERASER_SIZE}
                onEraseAtPoint={handleEraseAtPoint}
                onStrokeFinished={onStrokeFinished}
            />
            <WorkbenchChrome
                dropdownRef={dropdownRef}
                activeTool={activeWorkbenchTool}
                freehandColor={freehandColor}
                freehandStrokeWidth={freehandStrokeWidth}
                onSelectTool={setActiveWorkbenchTool}
                onFreehandColorChange={setFreehandColor}
                onFreehandStrokeWidthChange={setFreehandStrokeWidth}
                onUndo={undoWorkbench}
                onRedo={redoWorkbench}
                onMediaUpload={handleMediaUpload}
                onMediaUploadFromPhone={handleMediaUploadFromPhone}
                sketchFormats={sketchFormats}
                onFormatSelect={handleFormatSelect}
                mediaUploadInputRef={mediaUploadInputRef}
                onMediaUploadChange={handleMediaUploadChange}
                isPhoneUploadModalOpen={isPhoneUploadModalOpen}
                onClosePhoneUploadModal={closePhoneUploadModal}
                onPhoneUploadComplete={handlePhoneUploadComplete}
                zoomLevel={zoom}
                onZoomIn={() => zoomIn({ duration: 300 })}
                onZoomOut={() => zoomOut({ duration: 300 })}
                onResetZoom={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })}
                onFitToScreen={() => fitView({ duration: 300 })}
                contextMenu={contextMenu}
                onCloseContextMenu={() => setContextMenu(null)}
                contextMenuActions={contextMenuActions}
                basicBlocksMenu={basicBlocksMenu}
                onBlockSelect={handleBlockSelect}
            />
        </div>
    );
};

export const Workbench: React.FC = () => {
    return (
        <ReactFlowProvider>
            <WorkbenchContent />
        </ReactFlowProvider>
    );
};
