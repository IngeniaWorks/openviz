import type { WorkbenchToolType } from '@/types';

/**
 * React Flow props derived from the active tool mode (C-3.1, C-3.2).
 * Pure so the contract is unit-testable without rendering the canvas (T018).
 */
export function getFlowModeProps(mode: WorkbenchToolType) {
    const isSelect = mode === 'select';
    const isHand = mode === 'hand';

    return {
        selectionOnDrag: isSelect,
        panOnDrag: isHand,
        elementsSelectable: isSelect,
        nodesDraggable: isSelect,
        nodesConnectable: isSelect,
    };
}
