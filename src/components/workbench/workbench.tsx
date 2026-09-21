import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { WorkbenchConnectionLine } from '../nodes/WorkbenchConnectionLine';
import { DrawingOverlay } from '@/drawing/DrawingOverlay';
import { getBoundingBox, pointsToPath, Point } from '@/drawing/strokeUtils';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import {
    ArrowWorkbenchNode,
    FreehandNode as FreehandWorkbenchNode,
    MediaWorkbenchNode,
    NoteWorkbenchNode,
    TextWorkbenchNode,
    WorkbenchToolType,
} from '@/types';
import { WorkbenchToolbar } from './WorkbenchToolbar';
import { PhoneUploadModal } from './PhoneUploadModal';

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

const ERASER_SIZE = 48;

const WorkbenchContent: React.FC = () => {
    const flowWrapperRef = useRef<HTMLDivElement>(null);
    const mediaUploadInputRef = useRef<HTMLInputElement>(null);
    const arrowDragStartRef = useRef<{ x: number; y: number } | null>(null);
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

    useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            return;
        }

        const resizeObserverMessages = new Set([
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications.',
        ]);

        const toMessage = (value: unknown): string => {
            if (typeof value === 'string') {
                return value;
            }
            if (value instanceof Error) {
                return value.message;
            }
            if (value && typeof value === 'object' && 'message' in value) {
                const maybeMessage = (value as { message?: unknown }).message;
                if (typeof maybeMessage === 'string') {
                    return maybeMessage;
                }
            }
            return '';
        };

        const debugSuppression = process.env.NEXT_PUBLIC_DEBUG_RESIZE_OBSERVER === 'true';

        const suppress = (event: Event, message: string) => {
            if (!resizeObserverMessages.has(message)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            if (debugSuppression) {
                console.debug('[WorkbenchResize] Suppressed ResizeObserver warning', { message });
            }
        };

        const onWindowError = (event: ErrorEvent) => {
            const message = toMessage(event.message || event.error);
            suppress(event, message);
        };

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            const message = toMessage(event.reason);
            suppress(event, message);
        };

        window.addEventListener('error', onWindowError, true);
        window.addEventListener('unhandledrejection', onUnhandledRejection, true);

        return () => {
            window.removeEventListener('error', onWindowError, true);
            window.removeEventListener('unhandledrejection', onUnhandledRejection, true);
        };
    }, []);

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
    const [isPhoneUploadModalOpen, setIsPhoneUploadModalOpen] = useState(false);

    useWorkbenchCenterOnReturn({ viewMode, activeNodeId, workbenchNodes, setCenter });
    const { nodes, edges } = useWorkbenchGraph({
        workbenchNodes,
        connections,
        selectedNodeIds,
        handleSourceClick,
        handleResize,
        handleDataChange,
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

    // FR-007: one-shot creation is an atomic store action (T006) — the view
    // only builds the node payload; select + tool switch happen in one update.
    const makeOneShotNode = useCallback(
        (node: TextWorkbenchNode | NoteWorkbenchNode | ArrowWorkbenchNode | MediaWorkbenchNode) => {
            createOneShotNode(node);
        },
        [createOneShotNode]
    );

    const handleEraseAtPoint = useCallback(
        (point: Point) => {
            if (activeWorkbenchTool !== 'eraser') {
                return;
            }

            const eraserRadius = ERASER_SIZE / 2;
            const intersectedFreehandNodeIds = workbenchNodes
                .filter((node) => node.type === 'freehand')
                .filter((node) => {
                    const strokePadding = Math.max(2, (node.data.strokeWidth ?? 0) / 2);
                    const minX = node.x - eraserRadius - strokePadding;
                    const minY = node.y - eraserRadius - strokePadding;
                    const maxX = node.x + (node.width ?? 0) + eraserRadius + strokePadding;
                    const maxY = node.y + (node.height ?? 0) + eraserRadius + strokePadding;

                    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
                })
                .map((node) => node.id);

            intersectedFreehandNodeIds.forEach((nodeId) => {
                removeWorkbenchNode(nodeId);
            });
        },
        [activeWorkbenchTool, removeWorkbenchNode, workbenchNodes]
    );

    const createTextOrNoteNodeAt = useCallback((tool: WorkbenchToolType, clientX: number, clientY: number) => {
        const flowPoint = screenToFlowPosition({ x: clientX, y: clientY });
        if (tool === 'text') {
            const textNode: TextWorkbenchNode = {
                id: crypto.randomUUID(),
                type: 'text',
                x: flowPoint.x - 120,
                y: flowPoint.y - 36,
                width: 240,
                height: 72,
                data: {
                    text: '',
                    fontSize: 24,
                    color: '#111827',
                },
            };
            makeOneShotNode(textNode);
            return;
        }

        if (tool === 'note') {
            const noteNode: NoteWorkbenchNode = {
                id: crypto.randomUUID(),
                type: 'note',
                x: flowPoint.x - 110,
                y: flowPoint.y - 90,
                width: 220,
                height: 180,
                data: {
                    text: '',
                    colorVariant: 'yellow',
                },
            };
            makeOneShotNode(noteNode);
        }
    }, [makeOneShotNode, screenToFlowPosition]);

    const handlePaneClickWithTool = useCallback((event: React.MouseEvent) => {
        handlePaneClick();
        if (activeWorkbenchTool === 'text' || activeWorkbenchTool === 'note') {
            createTextOrNoteNodeAt(activeWorkbenchTool, event.clientX, event.clientY);
        }
    }, [activeWorkbenchTool, createTextOrNoteNodeAt, handlePaneClick]);

    const isPaneTarget = (target: EventTarget | null) =>
        target instanceof Element && target.closest('.react-flow__pane');

    const handleCanvasMouseDownForArrow = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!isPaneTarget(event.target)) {
            arrowDragStartRef.current = null;
            return;
        }

        if (activeWorkbenchTool !== 'arrow' || event.button !== 0) {
            arrowDragStartRef.current = null;
            return;
        }

        arrowDragStartRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    }, [activeWorkbenchTool, screenToFlowPosition]);

    const handleCanvasMouseUpForArrow = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!isPaneTarget(event.target)) {
            return;
        }

        if (activeWorkbenchTool !== 'arrow' || !arrowDragStartRef.current) {
            return;
        }

        const start = arrowDragStartRef.current;
        const end = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        arrowDragStartRef.current = null;

        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;
        const distance = Math.hypot(deltaX, deltaY);
        const padding = 20;
        const minWidth = 120;
        const minHeight = 80;
        const width = Math.max(minWidth, Math.abs(deltaX) + padding * 2);
        const height = Math.max(minHeight, Math.abs(deltaY) + padding * 2);
        const x = Math.min(start.x, end.x) - padding;
        const y = Math.min(start.y, end.y) - padding;

        const normalizedStart =
            distance < 8
                ? { x: 20, y: height - 20 }
                : { x: start.x - x, y: start.y - y };
        const normalizedEnd =
            distance < 8
                ? { x: width - 20, y: 20 }
                : { x: end.x - x, y: end.y - y };

        const midX = (normalizedStart.x + normalizedEnd.x) / 2;
        const midY = (normalizedStart.y + normalizedEnd.y) / 2;
        const control = {
            x: midX + (normalizedStart.y - normalizedEnd.y) * 0.18,
            y: midY + (normalizedEnd.x - normalizedStart.x) * 0.18,
        };

        const arrowNode: ArrowWorkbenchNode = {
            id: crypto.randomUUID(),
            type: 'arrow',
            x,
            y,
            width,
            height,
            data: {
                start: normalizedStart,
                end: normalizedEnd,
                control,
                strokeColor: '#111827',
                strokeWidth: 2,
            },
        };

        makeOneShotNode(arrowNode);
        requestImmediateSceneSave();
    }, [activeWorkbenchTool, makeOneShotNode, screenToFlowPosition]);

    const handleMediaUpload = useCallback(() => {
        mediaUploadInputRef.current?.click();
    }, []);

    const handleMediaUploadFromPhone = useCallback(() => {
        setIsPhoneUploadModalOpen(true);
    }, []);

    const handlePhoneUploadComplete = useCallback((info: { url: string; fileName: string; mimeType: string }) => {
        const wrapperRect = flowWrapperRef.current?.getBoundingClientRect();
        const centerPoint = wrapperRect
            ? screenToFlowPosition({
                x: wrapperRect.left + wrapperRect.width / 2,
                y: wrapperRect.top + wrapperRect.height / 2,
            })
            : { x: 200, y: 200 };

        const mediaNode: MediaWorkbenchNode = {
            id: crypto.randomUUID(),
            type: 'media',
            x: centerPoint.x - 130,
            y: centerPoint.y - 90,
            width: 260,
            height: 180,
            data: {
                src: info.url,
                alt: info.fileName || 'Uploaded media',
                mimeType: info.mimeType,
            },
        };

        makeOneShotNode(mediaNode);
        setIsPhoneUploadModalOpen(false);
    }, [makeOneShotNode, screenToFlowPosition]);

    const handleMediaUploadChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const wrapperRect = flowWrapperRef.current?.getBoundingClientRect();
        const centerPoint = wrapperRect
            ? screenToFlowPosition({
                x: wrapperRect.left + wrapperRect.width / 2,
                y: wrapperRect.top + wrapperRect.height / 2,
            })
            : { x: 200, y: 200 };

        const mediaNode: MediaWorkbenchNode = {
            id: crypto.randomUUID(),
            type: 'media',
            x: centerPoint.x - 130,
            y: centerPoint.y - 90,
            width: 260,
            height: 180,
            data: {
                src: objectUrl,
                alt: file.name || 'Uploaded media',
                mimeType: file.type,
            },
        };

        makeOneShotNode(mediaNode);
        event.target.value = '';
    }, [makeOneShotNode, screenToFlowPosition]);

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
    const isHandModeActive = activeWorkbenchTool === 'hand';
    const isSelectModeActive = activeWorkbenchTool === 'select';

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
                selectionOnDrag={isSelectModeActive}
                selectionKeyCode="Shift"
                multiSelectionKeyCode={['Meta', 'Control']}
                panOnDrag={isHandModeActive}
                elementsSelectable={isSelectModeActive}
                nodesDraggable={isSelectModeActive}
                nodesConnectable={isSelectModeActive}
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
                onStrokeFinished={(points) => {
                    const boundingBox = getBoundingBox(points);
                    if (!boundingBox) {
                        return;
                    }

                    const normalizedPoints: Point[] = points.map((point) => ({
                        x: point.x - boundingBox.minX,
                        y: point.y - boundingBox.minY,
                    }));
                    const path = pointsToPath(normalizedPoints, { size: freehandStrokeWidth });

                    if (!path.trim()) {
                        return;
                    }

                    const width = Math.max(1, boundingBox.width);
                    const height = Math.max(1, boundingBox.height);

                    const freehandNode: FreehandWorkbenchNode = {
                        id: crypto.randomUUID(),
                        type: 'freehand',
                        x: boundingBox.minX,
                        y: boundingBox.minY,
                        width,
                        height,
                        data: {
                            path,
                            width,
                            height,
                            color: freehandColor,
                            strokeWidth: freehandStrokeWidth,
                        },
                    };

                    addWorkbenchNode(freehandNode);
                    if (activeWorkbenchTool === 'draw') {
                        setActiveNodeId(freehandNode.id);
                        setSelectedNodeIds([freehandNode.id]);
                    }
                    requestImmediateSceneSave();
                }}
            />
            <input
                ref={mediaUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMediaUploadChange}
            />

            <PhoneUploadModal
                open={isPhoneUploadModalOpen}
                onClose={() => setIsPhoneUploadModalOpen(false)}
                onUploadComplete={handlePhoneUploadComplete}
            />
            <div className="absolute top-4 left-4 z-20">
                <ProjectHeader mode="workbench" />
            </div>

            <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
                <div ref={dropdownRef}>
                    <WorkbenchToolbar
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
                    />
                </div>
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
