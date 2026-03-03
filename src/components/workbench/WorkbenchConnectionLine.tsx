import { ConnectionLineComponentProps, getSmoothStepPath } from '@xyflow/react';

export function WorkbenchConnectionLine({
    fromX,
    fromY,
    fromPosition,
    toX,
    toY,
    toPosition,
}: ConnectionLineComponentProps) {
    const [path] = getSmoothStepPath({
        sourceX: fromX,
        sourceY: fromY,
        sourcePosition: fromPosition,
        targetX: toX,
        targetY: toY,
        targetPosition: toPosition,
        borderRadius: 15,
    });

    return <path d={path} fill="none" stroke="#475569" strokeWidth={2} />;
}
