import { useCallback, useRef, useState } from 'react';
import {
    Node,
    NodeChange,
    OnNodesChange,
    applyNodeChanges,
} from '@xyflow/react';

import { WorkbenchNode } from '@/types';

import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { normalizeArrowGeometry } from '@/services/workbench/arrowGeometry';
import { buildFlowNodes } from './workbenchNodeSizing';
import { BasicBlocksMenuState } from './useWorkbenchBlockCreation';

type ContextMenuState = { x: number; y: number; nodeId: string } | null;

type UseWorkbenchNodeHandlersOptions = {
    workbenchNodes: WorkbenchNode[];
    selectedNodeIds: string[];
    setSelectedNodeIds: (ids: string[]) => void;
    updateWorkbenchNode: (id: string, updates: Partial<WorkbenchNode>) => void;
    removeWorkbenchNode: (id?: string) => void;
    openNodeInStudio: (id: string) => void;
    setActiveNodeId: (id: string | null) => void;
    setBasicBlocksMenu: (value: BasicBlocksMenuState) => void;
};

export function useWorkbenchNodeHandlers({
    workbenchNodes,
    selectedNodeIds,
    setSelectedNodeIds,
    updateWorkbenchNode,
    removeWorkbenchNode,
    openNodeInStudio,
    setActiveNodeId,
    setBasicBlocksMenu,
}: UseWorkbenchNodeHandlersOptions) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const resizingNodeIdsRef = useRef<Set<string>>(new Set());

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        const flowNodes = buildFlowNodes(workbenchNodes, selectedNodeIds);
        applyNodeChanges(changes as NodeChange[], flowNodes);

        changes.forEach((change) => {
            if (change.type === 'dimensions') {
                if (change.resizing) {
                    resizingNodeIdsRef.current.add(change.id);
                } else {
                    resizingNodeIdsRef.current.delete(change.id);
                }
            } else if (change.type === 'position' && change.position) {
                if (resizingNodeIdsRef.current.has(change.id)) {
                    return;
                }
                updateWorkbenchNode(change.id, {
                    x: change.position.x,
                    y: change.position.y,
                });
            }
            // Dimension changes are handled by onResizeEnd in nodes - not here
            // This prevents flooding Zustand during drag operations
            else if (change.type === 'remove') {
                removeWorkbenchNode(change.id);
            } else if (change.type === 'select') {
                if (change.selected) {
                    if (!selectedNodeIds.includes(change.id)) {
                        setSelectedNodeIds([...selectedNodeIds, change.id]);
                    }
                } else if (selectedNodeIds.includes(change.id)) {
                    setSelectedNodeIds(selectedNodeIds.filter((id) => id !== change.id));
                }
            }
        });
    }, [updateWorkbenchNode, removeWorkbenchNode, setSelectedNodeIds, selectedNodeIds, workbenchNodes]);

    const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
        const workbenchNode = workbenchNodes.find((n) => n.id === node.id);
        if (workbenchNode?.type === 'image') {
            openNodeInStudio(node.id);
        }
    }, [workbenchNodes, openNodeInStudio]);

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    }, []);

    const handlePaneClick = useCallback(() => {
        setActiveNodeId(null);
        setBasicBlocksMenu(null);
    }, [setActiveNodeId, setBasicBlocksMenu]);

    const handleSourceClick = useCallback((nodeId: string) => {
        const sourceNode = workbenchNodes.find((n) => n.id === nodeId);
        if (sourceNode) {
            const rect = document.querySelector(`[data-id="${nodeId}"]`)?.getBoundingClientRect();
            if (rect) {
                setBasicBlocksMenu({
                    visible: true,
                    x: rect.right + 15,
                    y: rect.top + rect.height / 2,
                    sourceNodeId: nodeId,
                });
            }
        }
    }, [workbenchNodes, setBasicBlocksMenu]);

    const handleResize = useCallback((nodeId: string, width: number, height: number, x?: number, y?: number) => {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }

        const node = workbenchNodes.find((n) => n.id === nodeId);
        if (!node) {
            return;
        }

        const xUpdate = Number.isFinite(x) ? x : undefined;
        const yUpdate = Number.isFinite(y) ? y : undefined;

        if (node.type === 'arrow') {
            // C-5.2: re-scale start/end/control by the per-axis ratio so the
            // shape is preserved without distortion (pure math in arrowGeometry).
            const currentWidth = Number.isFinite(node.width) && (node.width as number) > 0 ? (node.width as number) : width;
            const currentHeight = Number.isFinite(node.height) && (node.height as number) > 0 ? (node.height as number) : height;
            const nextData = normalizeArrowGeometry(node.data, currentWidth, currentHeight, width, height);

            updateWorkbenchNode(nodeId, {
                width,
                height,
                data: nextData,
                ...(xUpdate !== undefined ? { x: xUpdate } : {}),
                ...(yUpdate !== undefined ? { y: yUpdate } : {}),
            });
            // Resize gesture finished (mouse released) - sync immediately.
            requestImmediateSceneSave();
            return;
        }

        if ((node.type === 'image' || node.type === 'video') && node.project?.canvas) {
            const canvasWidth = node.project?.canvas?.width;
            if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) {
                updateWorkbenchNode(nodeId, {
                    width,
                    height,
                    ...(xUpdate !== undefined ? { x: xUpdate } : {}),
                    ...(yUpdate !== undefined ? { y: yUpdate } : {}),
                });
                return;
            }

            const scale = width / canvasWidth;
            if (!Number.isFinite(scale) || scale <= 0) {
                return;
            }

            updateWorkbenchNode(nodeId, {
                scale,
                width,
                height,
                ...(xUpdate !== undefined ? { x: xUpdate } : {}),
                ...(yUpdate !== undefined ? { y: yUpdate } : {}),
            });
        } else {
            updateWorkbenchNode(nodeId, {
                width,
                height,
                ...(xUpdate !== undefined ? { x: xUpdate } : {}),
                ...(yUpdate !== undefined ? { y: yUpdate } : {}),
            });
        }

        // Resize gesture finished (mouse released) - sync immediately.
        requestImmediateSceneSave();
    }, [updateWorkbenchNode, workbenchNodes]);

    const handleDataChange = useCallback((nodeId: string, data: Record<string, unknown>) => {
        const node = workbenchNodes.find((n) => n.id === nodeId);
        if (!node || !('data' in node)) {
            return;
        }

        const updates = {
            data: {
                ...(node.data as Record<string, unknown>),
                ...data,
            },
        } as Partial<WorkbenchNode>;

        updateWorkbenchNode(nodeId, updates);
    }, [updateWorkbenchNode, workbenchNodes]);

    return {
        contextMenu,
        setContextMenu,
        handleNodesChange,
        handleNodeDoubleClick,
        handleNodeContextMenu,
        handlePaneClick,
        handleSourceClick,
        handleResize,
        handleDataChange,
    };
}
