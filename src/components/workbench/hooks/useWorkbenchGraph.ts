import { useMemo } from "react";
import { Edge, Node } from "@xyflow/react";
import { Connection, WorkbenchNode } from "@/types";

type WorkbenchGraphOptions = {
    workbenchNodes: WorkbenchNode[];
    connections: Connection[];
    selectedNodeIds: string[];
    handleSourceClick: (nodeId: string) => void;
    handleResize: (nodeId: string, width: number, height: number) => void;
};

type WorkbenchFlowNodeType = "imageNode" | "videoNode" | "animateNode" | "renderNode";

function mapNodeType(node: WorkbenchNode): WorkbenchFlowNodeType {
    if (node.type === "image") return "imageNode";
    if (node.type === "video") return "videoNode";
    if (node.type === "animate") return "animateNode";
    return "renderNode";
}

function getNodeSize(node: WorkbenchNode) {
    let width = node.width;
    let height = node.height;

    if ((node.type === "image" || node.type === "video") && typeof node.scale === "number") {
        width = node.project.canvas.width * node.scale;
        height = node.project.canvas.height * node.scale;
    }

    return { width, height };
}

export function useWorkbenchGraph({
    workbenchNodes,
    connections,
    selectedNodeIds,
    handleSourceClick,
    handleResize,
}: WorkbenchGraphOptions) {
    const nodes = useMemo<Array<Node<Record<string, unknown>, WorkbenchFlowNodeType>>>(() => {
        return workbenchNodes.map((node) => {
            const { width, height } = getNodeSize(node);

            return {
                id: node.id,
                type: mapNodeType(node),
                position: { x: node.x, y: node.y },
                width,
                height,
                data: {
                    ...node,
                    onSourceClick: handleSourceClick,
                    onResize: handleResize,
                } as Record<string, unknown>,
                selected: selectedNodeIds.includes(node.id),
            };
        });
    }, [workbenchNodes, selectedNodeIds, handleSourceClick, handleResize]);

    const edges = useMemo<Array<Edge>>(() => {
        return connections.map((conn) => ({
            id: conn.id,
            source: conn.from,
            target: conn.to,
            sourceHandle: conn.sourceHandle ?? null,
            targetHandle: conn.targetHandle ?? null,
            type: "customEdge",
            style: { stroke: "#2F8CFF", strokeWidth: 2 },
            animated: false,
        }));
    }, [connections]);

    return { nodes, edges };
}
