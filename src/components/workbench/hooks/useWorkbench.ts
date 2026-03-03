import { useCallback, useState, useRef, useEffect } from 'react';
import {
    OnNodesChange,
    OnConnect,
    Connection,
    Node,
    useReactFlow,
    applyNodeChanges,
    NodeChange,
    OnConnectStart,
    OnConnectEnd,
} from '@xyflow/react';
import { useStore } from '../../../store/useStore';
import { WorkbenchNode } from '../../../types';
import { useShallow } from 'zustand/react/shallow';
import { useWorkbenchKeyboardShortcuts } from './useWorkbenchKeyboardShortcuts';
import { sketchFormats, useWorkbenchFormatMenu } from './useWorkbenchFormatMenu';

type ConnectionStartRef = { nodeId: string; handleType: string } | null;

type CanonicalConnection = {
    fromId: string;
    toId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
};

export function getCanonicalConnectionFromDrop(
    connectionStart: ConnectionStartRef,
    targetNodeId: string | null,
    workbenchNodes: WorkbenchNode[]
): CanonicalConnection | null {
    if (!connectionStart || !targetNodeId) {
        return null;
    }

    const sourceNode = workbenchNodes.find((n) => n.id === connectionStart.nodeId);
    const targetNode = workbenchNodes.find((n) => n.id === targetNodeId);

    if (!sourceNode || !targetNode) {
        return null;
    }

    const sourceIsTransformNode = sourceNode.type === 'animate' || sourceNode.type === 'render';
    if (connectionStart.handleType === 'target' && targetNode.type === 'image' && sourceIsTransformNode) {
        return {
            fromId: targetNode.id,
            toId: sourceNode.id,
            sourceHandle: 'image-source',
            targetHandle: null,
        };
    }

    return null;
}

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
    } = useStore(
        useShallow((state) => ({
            workbenchNodes: state.workbenchNodes,
            connections: state.connections,
            updateWorkbenchNode: state.updateWorkbenchNode,
            addWorkbenchNode: state.addWorkbenchNode,
            removeWorkbenchNode: state.removeWorkbenchNode,
            duplicateWorkbenchNode: state.duplicateWorkbenchNode,
            reorderWorkbenchNode: state.reorderWorkbenchNode,
            copyToClipboard: state.copyToClipboard,
            pasteFromClipboard: state.pasteFromClipboard,
            openNodeInStudio: state.openNodeInStudio,
            activeNodeId: state.activeNodeId,
            setActiveNodeId: state.setActiveNodeId,
            selectedNodeIds: state.selectedNodeIds,
            setSelectedNodeIds: state.setSelectedNodeIds,
            addConnection: state.addConnection,
            createSketchWithFormat: state.createSketchWithFormat,
        }))
    );

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
    const [basicBlocksMenu, setBasicBlocksMenu] = useState<{ visible: boolean; x: number; y: number; sourceNodeId: string } | null>(null);
    const connectionStart = useRef<ConnectionStartRef>(null);

    const { showFormatDropdown, setShowFormatDropdown, dropdownRef, handleFormatSelect } =
        useWorkbenchFormatMenu({ createSketchWithFormat });

    const mousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        const flowNodes = workbenchNodes.map((node) => ({
            id: node.id,
            position: { x: node.x, y: node.y },
            selected: selectedNodeIds.includes(node.id),
            data: {},
        }));
        const nextNodes = applyNodeChanges(changes as NodeChange[], flowNodes);

        changes.forEach((change) => {
            if (change.type === 'position' && change.position) {
                updateWorkbenchNode(change.id, {
                    x: change.position.x,
                    y: change.position.y,
                });
            } else if (change.type === 'remove') {
                removeWorkbenchNode(change.id);
            }
        });

        const nextSelectedNodeIds = nextNodes.filter((node) => node.selected).map((node) => node.id);
        setSelectedNodeIds(nextSelectedNodeIds);
    }, [updateWorkbenchNode, removeWorkbenchNode, setSelectedNodeIds, selectedNodeIds]);

    const { screenToFlowPosition } = useReactFlow();

    useWorkbenchKeyboardShortcuts({
        copyToClipboard, 
        pasteFromClipboard, 
        duplicateWorkbenchNode, 
        removeWorkbenchNode, 
        reorderWorkbenchNode, 
        activeNodeId, 
        selectedNodeIds, 
        screenToFlowPosition,
        getMousePosition: () => mousePos.current,
    });

    const handleConnect: OnConnect = useCallback((params: Connection) => {
        if (params.source && params.target) {
            addConnection(
                params.source,
                params.target,
                params.sourceHandle ?? null,
                params.targetHandle ?? null
            );
        }
    }, [addConnection]);

    const onConnectStart: OnConnectStart = useCallback((_, { nodeId, handleType }) => {
        if (!nodeId || !handleType) return;
        connectionStart.current = { nodeId, handleType };
    }, []);

    const onConnectEnd: OnConnectEnd = useCallback((event) => {
        if (!connectionStart.current) return;
        const target = event.target;
        if (!(target instanceof Element)) {
            connectionStart.current = null;
            return;
        }

        const nodeElement = target.closest('.react-flow__node');
        if (nodeElement) {
            const targetNodeId = nodeElement.getAttribute('data-id');
            const canonical = getCanonicalConnectionFromDrop(connectionStart.current, targetNodeId, workbenchNodes);
            if (canonical) {
                addConnection(
                    canonical.fromId,
                    canonical.toId,
                    canonical.sourceHandle ?? null,
                    canonical.targetHandle ?? null
                );
            }
        }
        connectionStart.current = null;
    }, [workbenchNodes, addConnection]);

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
    }, [setActiveNodeId]);

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
    }, [workbenchNodes]);

    const handleBlockSelect = useCallback((type: 'modify' | 'animate' | 'variate' | 'render') => {
        if (!basicBlocksMenu || (type !== 'animate' && type !== 'render')) {
            setBasicBlocksMenu(null);
            return;
        }

        const sourceNode = workbenchNodes.find((n) => n.id === basicBlocksMenu.sourceNodeId);
        if (!sourceNode) {
            setBasicBlocksMenu(null);
            return;
        }

        const sourceWidth = sourceNode.width ??
            ((sourceNode.type === 'image' || sourceNode.type === 'video') &&
            sourceNode.scale &&
            sourceNode.project?.canvas?.width
                ? sourceNode.scale * sourceNode.project.canvas.width
                : 320);
        const sourceHeight = sourceNode.height ??
            ((sourceNode.type === 'image' || sourceNode.type === 'video') &&
            sourceNode.scale &&
            sourceNode.project?.canvas?.height
                ? sourceNode.scale * sourceNode.project.canvas.height
                : 320);

        if (type === 'render') {
            const newNodeId = crypto.randomUUID();
            const nodeWidth = 320;
            const nodeHeight = 500;

            const newNode = {
                id: newNodeId,
                type: 'render',
                x: sourceNode.x + sourceWidth + 100,
                y: sourceNode.y,
                width: nodeWidth,
                height: nodeHeight,
                data: {
                    prompt: '',
                    stylePreset: 'Photorealistic',
                    drawingInfluence: 0.65,
                    numImages: 1,
                },
            };
            addWorkbenchNode(newNode as WorkbenchNode);
            addConnection(basicBlocksMenu.sourceNodeId, newNodeId);
            setBasicBlocksMenu(null);
            return;
        }

        const newNodeId = crypto.randomUUID();
        const nodeWidth = 320;
        const nodeHeight = 320;

        const newNode = {
            id: newNodeId,
            type: 'animate',
            x: sourceNode.x + sourceWidth + 100,
            y: sourceNode.y + (sourceHeight - nodeHeight) / 2,
            width: nodeWidth,
            height: nodeHeight,
            data: {
                prompt: '',
                frames: { start: sourceNode.id },
                settings: { model: 'default', duration: '2s' },
            },
        };
        addWorkbenchNode(newNode as WorkbenchNode);
        addConnection(basicBlocksMenu.sourceNodeId, newNodeId);
        setBasicBlocksMenu(null);
    }, [basicBlocksMenu, workbenchNodes, addWorkbenchNode, addConnection]);

    const handleResize = useCallback((nodeId: string, width: number, height: number) => {
        const node = workbenchNodes.find((n) => n.id === nodeId);
        if (node && (node.type === 'image' || node.type === 'video') && node.project?.canvas) {
            const scale = width / node.project.canvas.width;
            updateWorkbenchNode(nodeId, { scale, width, height });
        } else {
            updateWorkbenchNode(nodeId, { width, height });
        }
    }, [updateWorkbenchNode, workbenchNodes]);

    return {
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
    };
};
