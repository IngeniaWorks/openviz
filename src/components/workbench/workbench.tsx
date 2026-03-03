import React from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, ChevronDown } from 'lucide-react';

import { ImageNode } from './ImageNode';
import { VideoNode } from './VideoNode';
import { AnimateNode } from '../nodes/AnimateNode';
import { RenderNode } from '../nodes/RenderNode';
import { CustomEdge } from './CustomEdge';
import { PositionedMenu } from '../ContextMenu';
import { BasicBlocksMenu } from '../nodes/BasicBlocksMenu';
import { useWorkbench } from './hooks/useWorkbench';
import { useStore } from '../../store/useStore';
import { useAutoSaveScene } from '../../hooks/useAutoSaveScene';
import { CanvasControls } from '../studio/CanvasControls';
import { ProjectHeader } from '../common/ProjectHeader';
import { useWorkbenchCenterOnReturn } from './hooks/useWorkbenchCenterOnReturn';
import { useWorkbenchGraph } from './hooks/useWorkbenchGraph';
import { useSceneStream } from './hooks/useSceneStream';
import { useShallow } from 'zustand/react/shallow';
import { WorkbenchConnectionLine } from './WorkbenchConnectionLine';

const nodeTypes: NodeTypes = {
    imageNode: ImageNode,
    videoNode: VideoNode,
    animateNode: AnimateNode,
    renderNode: RenderNode,
};

const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

const WorkbenchContent: React.FC = () => {
    const { setCenter, zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
    const { zoom } = useViewport();
    const { viewMode, currentProjectId, nodeLocks, presenceByUser } = useStore(
        useShallow((state) => ({
            viewMode: state.viewMode,
            currentProjectId: state.currentProjectId,
            nodeLocks: state.nodeLocks,
            presenceByUser: state.presenceByUser,
        }))
    );
    const lockCount = Object.keys(nodeLocks).length;
    const collaboratorCount = Object.keys(presenceByUser).length;
    
    useAutoSaveScene(currentProjectId);
    useSceneStream(currentProjectId);
    const {
        workbenchNodes,
        connections,
        activeNodeId,
        selectedNodeIds,
        contextMenu,
        setContextMenu,
        showFormatDropdown,
        setShowFormatDropdown,
        dropdownRef,
        basicBlocksMenu,
        sketchFormats,
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
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode
    } = useWorkbench();

    useWorkbenchCenterOnReturn({ viewMode, activeNodeId, workbenchNodes, setCenter });
    const { nodes, edges } = useWorkbenchGraph({
        workbenchNodes,
        connections,
        selectedNodeIds,
        handleSourceClick,
        handleResize,
    });

    const contextMenuActions = contextMenu ? [
        { label: 'Wrap in section', onClick: () => console.log('Wrap in section'), divider: true },
        { label: 'Bring to front', shortcut: ']', onClick: () => reorderWorkbenchNode(contextMenu.nodeId, 'front') },
        { label: 'Send to back', shortcut: '[', onClick: () => reorderWorkbenchNode(contextMenu.nodeId, 'back'), divider: true },
        {
            label: 'Copy link to selection', shortcut: 'Ctrl+L', onClick: () => {
                navigator.clipboard.writeText(window.location.href);
            }, divider: true
        },
        { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => copyToClipboard(contextMenu.nodeId) },
        {
            label: 'Paste', shortcut: 'Ctrl+V', onClick: () => {
                const pos = { x: 100, y: 100 };
                pasteFromClipboard(pos);
            }
        },
        { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: () => duplicateWorkbenchNode(contextMenu.nodeId), divider: true },
        { label: 'Delete', shortcut: 'Del', onClick: () => removeWorkbenchNode(contextMenu.nodeId), type: 'danger' as const },
    ] : [];

    return (
        <div className="relative w-full h-screen bg-white">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChange}
                onConnect={handleConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeContextMenu={handleNodeContextMenu}
                onPaneClick={handlePaneClick}
                deleteKeyCode={['Backspace', 'Delete']}
                selectionMode={SelectionMode.Partial}
                selectionOnDrag={true}
                selectionKeyCode="Shift"
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

            <div className="absolute top-4 left-4 z-20">
                <ProjectHeader mode="workbench" />
            </div>

            <div className="absolute bottom-4 right-4 z-20">
                <CanvasControls
                    zoomLevel={zoom}
                    onZoomIn={() => zoomIn({ duration: 300 })}
                    onZoomOut={() => zoomOut({ duration: 300 })}
                    onResetZoom={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })}
                    onFitToScreen={() => fitView({ duration: 300 })}
                />
            </div>

            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-full border border-panel-border bg-panel/85 backdrop-blur-md shadow-xl text-xs text-text-secondary">
                    <span>Workbench Command Surface</span>
                    <span className="px-2 py-0.5 rounded-full bg-black/20 border border-panel-border/60 text-[11px]">
                        Locks {lockCount}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-black/20 border border-panel-border/60 text-[11px]">
                        Presence {collaboratorCount}
                    </span>
                </div>
            </div>

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10" ref={dropdownRef}>
                <div className="relative">
                    <button
                        onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-panel border border-panel-border rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 text-text-secondary hover:text-white transition-all group"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                        <span className="font-medium">Add Sketch</span>
                        <ChevronDown size={16} className={`transition-transform ${showFormatDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showFormatDropdown && (
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48 bg-panel border border-panel-border rounded-lg shadow-2xl backdrop-blur-md bg-opacity-95 overflow-hidden nowheel nodrag">
                            {sketchFormats.map((format, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleFormatSelect(format.width, format.height)}
                                    className="w-full px-4 py-3 text-left text-text-secondary hover:text-white hover:bg-panel-light transition-colors flex items-center justify-between border-b border-panel-border last:border-b-0"
                                >
                                    <span className="text-sm font-medium">{format.label}</span>
                                    <span className="text-xs opacity-50">{format.width}×{format.height}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {contextMenu && (
                <PositionedMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    open={!!contextMenu}
                    onClose={() => setContextMenu(null)}
                    actions={contextMenuActions}
                />
            )}

            {basicBlocksMenu?.visible && (
                <div
                    className="fixed z-50"
                    style={{
                        left: basicBlocksMenu.x,
                        top: basicBlocksMenu.y,
                        transform: 'translateY(-50%)',
                    }}
                >
                    <BasicBlocksMenu onSelect={handleBlockSelect} onClose={() => { }} />
                </div>
            )}
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
