# Plan: Atomic Undo History for Workbench Node Gestures

**Generated**: 2026-04-21  
**Estimated Complexity**: Medium–High

## Overview

When a Workbench node is dragged, React Flow emits many position changes while the pointer is moving. The current `updateWorkbenchNode` path commits each of those changes to `workbenchHistory`, so Undo walks through drag points instead of treating the drag as one user action.

The recommended behavior is gesture-based history:

- A pointer gesture captures the state at gesture start.
- Intermediate position/resize/arrow-handle updates remain live in the UI but do not create history entries.
- Release commits exactly one snapshot if the final state differs from the starting state.
- Undo restores the complete pre-gesture state; Redo reapplies the complete final state.
- A click without movement creates no history entry.
- Dragging a selected group is one atomic operation covering all moved nodes.
- The same transaction behavior applies to node movement, node resize, and custom arrow-handle geometry edits.

This keeps the existing Workbench-only history model and toolbar/keyboard behavior while adding an explicit transient-gesture boundary around high-frequency updates.

## Current Findings

- `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts` sends every React Flow `position` change to `updateWorkbenchNode`.
- `src/components/workbench/workbench.tsx` has `onNodeDragStop`, but it currently performs another normal update and scene save rather than closing a history transaction.
- `src/store/slices/workbenchSlice.ts` uses `commitWorkbenchHistory` for `updateWorkbenchNode`, so every drag point can become a snapshot.
- React Flow v12 exposes `NodePositionChange` updates during dragging and `OnNodeDrag` receives the dragged node plus the affected node list; this supports capturing group movement and finalizing at drag stop.
- Resize callbacks already distinguish the final resize callback in `handleResize`, but they currently update through the normal history-committing action.
- Arrow handle changes flow through `ArrowNode` → `handleDataChange` → `updateWorkbenchNode` and need an equivalent start/end transaction boundary if they are to be atomic.

## Prerequisites

- Existing Zustand Workbench history in `src/store/slices/workbenchSlice.ts`.
- Existing React Flow callbacks in `src/components/workbench/workbench.tsx`.
- Existing node handler and resize plumbing in `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`.
- No new dependency is expected.

## Expected Behavior Contract

### Position movement

1. Selecting or clicking a node without changing its position does not affect undo history.
2. On the first movement of a gesture, capture the complete relevant Workbench snapshot (nodes, connections, selection, and active node state as currently defined by `WorkbenchHistorySnapshot`).
3. Apply intermediate positions to the live store without appending snapshots.
4. On pointer release, commit one final snapshot if any node position changed.
5. Undo returns every affected node to its pre-drag position in one step, including multi-selection drags.
6. Redo reapplies all final positions in one step.
7. If the gesture is interrupted/cancelled, do not leave a partial history entry; if cancellation can be detected reliably, restore the start snapshot, otherwise commit only a meaningful completed final state according to the chosen event lifecycle.

### Resize and arrow-handle movement

- A resize gesture creates at most one history entry, including width/height/scale and any position changes caused by resizing.
- An arrow start/end/control-handle drag creates at most one history entry containing the final arrow geometry.
- A no-op resize or handle gesture creates no entry.
- Existing immediate scene-save behavior remains at gesture completion, not for every intermediate update.

### Other edits

- Node creation, deletion, connection changes, duplication, reorder, and paste remain individual logical history actions.
- Text/content typing is not part of this movement fix unless implementation review finds it is already incorrectly coupled to the same gesture transaction; it should not be accidentally grouped with a node move.
- Undo/Redo continues to operate on Workbench history and must not switch back to Studio `project` history.

## Sprint 1: Add Transaction-Aware Workbench History

**Goal**: Make the store capable of applying transient updates and committing one final snapshot without changing visible behavior yet.  
**Demo/Validation**: Store tests can begin a transaction, apply multiple updates, commit once, and undo/redo across the resulting single entry.

### Task 1.1: Define gesture transaction state and actions

- **Location**: `src/store/storeTypes.ts`, `src/store/slices/workbenchSlice.ts`
- **Description**: Extend the Workbench store contract with a narrowly typed transaction mechanism. Prefer an explicit begin/commit/cancel API or equivalent internal action over exposing mutable history internals. The transaction must retain the starting snapshot and support nested/duplicate-start protection.
- **Dependencies**: None
- **Acceptance Criteria**:
  - The API can represent an active gesture and its starting snapshot.
  - No `any`, casts that bypass type safety, or direct mutation of history arrays are introduced.
  - Existing non-gesture mutations retain current commit semantics.
- **Validation**: TypeScript check and focused store tests.

### Task 1.2: Separate live updates from history commits

- **Location**: `src/store/slices/workbenchSlice.ts`
- **Description**: Refactor the shared update path so a transient update changes `workbenchNodes`/`projectNodes` live but does not append a history snapshot. Finalization compares the transaction start and current state and calls `commitWorkbenchHistory` once only when the state changed. Ensure redo history is truncated only at final commit, not at every intermediate point.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Ten intermediate updates followed by one commit produce one history step.
  - A no-op transaction produces zero history steps.
  - Undo and redo restore complete snapshots.
  - Scene/project node synchronization remains correct during and after transient updates.
- **Validation**: Unit tests for history length/index, undo, redo, no-op, and redo-branch invalidation.

### Task 1.3: Add store regression tests

- **Location**: `src/store/slices/workbenchSlice.test.ts` or a focused history test alongside it
- **Description**: Cover position-like updates using representative note, text, image, video, arrow, and freehand-compatible Workbench node data where appropriate.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Repeated updates to a sticky note result in one undoable final move.
  - Undo restores the exact original x/y and redo restores the exact final x/y.
  - A no-movement transaction leaves history unchanged.
  - Multi-node final state is restored atomically.
- **Validation**: `pnpm exec vitest src/store/slices/workbenchSlice.test.ts`.

## Sprint 2: Make React Flow Position Drags Atomic

**Goal**: Fix the reported sticky-note drag behavior and apply it to every draggable Workbench node.  
**Demo/Validation**: Drag “Test” through many points, release, click Undo once, and observe one jump back to the original position; Redo returns it to the drop position.

### Task 2.1: Capture drag start and affected nodes

- **Location**: `src/components/workbench/workbench.tsx`, `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`, and the relevant hook option types
- **Description**: Add the React Flow drag-start/drag-stop lifecycle required to begin a transaction before movement and identify the full affected node set for group drags. Keep the ref/state lifecycle stable across rerenders and avoid starting transactions for non-select tools.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Single-node and multi-selection drags begin one transaction.
  - Position updates remain visually smooth.
  - Selection-only clicks do not begin a committed history operation.
- **Validation**: Component/hook tests with mocked React Flow callbacks and manual group-drag smoke test.

### Task 2.2: Route position changes through transient updates

- **Location**: `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`
- **Description**: Change `position` handling so drag-time updates use the transaction-aware live-update path rather than normal history commits. Preserve existing resize guards, selection behavior, node removal behavior, and grid snapping.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Intermediate `NodePositionChange` events do not increase history length.
  - Every affected node’s final x/y is retained.
  - Existing node deletion and selection handling are unaffected.
- **Validation**: Focused handler tests plus Workbench store history assertions.

### Task 2.3: Commit on drag release and save once

- **Location**: `src/components/workbench/workbench.tsx`
- **Description**: Update `onNodeDragStop` to finalize the active transaction using the final React Flow positions, then request the immediate scene save once. Remove the redundant normal update that currently creates another history opportunity. Handle missing/stale transaction state defensively.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - One completed drag creates no more than one history snapshot.
  - Undo returns the complete pre-drag state, not the prior drag point.
  - Redo returns the final dropped positions.
  - A no-op drag does not add history or trigger an unnecessary scene save.
- **Validation**: Regression test for the “Test” sticky note scenario and manual browser verification at the supplied project URL.

## Sprint 3: Extend Atomic Semantics to Resize and Arrow Handles

**Goal**: Apply the requested gesture rule consistently to all node-manipulation gestures that currently emit repeated updates.  
**Demo/Validation**: Resize a node and move an arrow handle through multiple points; each gesture undoes/redoes in one step.

### Task 3.1: Make resize lifecycle transactional

- **Location**: `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`, `src/components/workbench/hooks/workbenchNodeSizing.ts` or the node-resizer wiring discovered during implementation
- **Description**: Begin a resize transaction on the first resize update, send intermediate width/height/scale/position changes as live updates, and finalize on the existing resize-end path. Preserve arrow normalization and image/video scale calculations.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Arrow, image, video, and ordinary node resize each produce one history entry.
  - Final dimensions, scale, position, and normalized arrow data are exact.
  - No-op resize produces no entry.
  - Immediate scene save runs at completion only.
- **Validation**: Resize handler tests for each node category and manual smoke test.

### Task 3.2: Add arrow-handle drag start/end boundaries

- **Location**: `src/components/nodes/ArrowNode.tsx`, `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`, and graph callback types
- **Description**: Add explicit handle-drag lifecycle callbacks without changing the existing coordinate math. Route intermediate `start`, `end`, and `control` data through transient updates and finalize once when the pointer is released. If the component currently has no release callback, add the smallest typed callback contract needed and use pointer capture/cleanup as appropriate.
- **Dependencies**: Sprint 3, Task 3.1
- **Acceptance Criteria**:
  - Each arrow-handle gesture is one undoable operation.
  - Start/end/control handle changes are preserved exactly.
  - Clicking a handle without changing it creates no history entry.
  - Existing `nodrag`/`nopan` behavior and arrow tests remain valid.
- **Validation**: Extend `src/components/nodes/ArrowNode.test.tsx` and add store/handler transaction assertions.

## Sprint 4: Converge, Document, and Verify

**Goal**: Confirm the behavior across all Workbench node types and prevent regression.  
**Demo/Validation**: Full test/lint/build checks plus a manual matrix of gestures and undo/redo outcomes.

### Task 4.1: Add end-to-end or integration coverage for gesture history

- **Location**: Existing Workbench tests; optionally `e2e/` if the test harness can launch the app reliably
- **Description**: Cover single-node sticky-note movement, each representative draggable node type, multi-selection movement, no-op click/drag, resize, arrow handles, undo, redo, and making a new edit after undo.
- **Dependencies**: Sprints 2–3
- **Acceptance Criteria**:
  - The reported sticky-note case is explicitly represented.
  - History contains logical gestures rather than pointer samples.
  - New edits after undo discard the redo branch only once the gesture commits.
- **Validation**: `pnpm test` or focused Vitest commands; Playwright/manual browser run where available.

### Task 4.2: Run quality gates and inspect file size

- **Location**: Repository root
- **Description**: Run lint, TypeScript/build checks, and the relevant tests. If transaction code pushes a file beyond the project’s 250/300-line guidance, split pure history helpers/types from the slice before completion.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - `pnpm run lint` passes.
  - `pnpm run build` passes.
  - Focused and full relevant tests pass.
  - No `any`, `@ts-ignore`, inline styles, or misplaced effects/fetch calls are introduced.
- **Validation**: Commands above and manual review of the diff.

## Testing Strategy

- **Store unit tests**: transaction begin/live update/commit/cancel, no-op suppression, multi-node snapshots, undo/redo, history cap, and redo invalidation.
- **Handler tests**: repeated React Flow position events update live without history growth; drag stop commits once; selection and deletion remain unchanged.
- **Component tests**: arrow-handle pointer lifecycle and existing coordinate behavior.
- **Integration/E2E**: supplied project URL, sticky note “Test”, movement through several points, one Undo to original position, one Redo to final position.
- **Regression matrix**: note, text, image, video, render/animate-like nodes, freehand node where draggable, multi-selection, resize, arrow geometry, no-op gesture, and interrupted gesture.

## Potential Risks & Gotchas

- **React Flow’s controlled-node timing**: `onNodesChange` and `onNodeDragStop` can expose slightly different positions. The final callback’s node list must be treated as authoritative, with a defensive fallback to current store positions.
- **Group movement**: Only committing the callback’s single `node` argument could omit other selected nodes. Use the affected-node collection or the stored start snapshot to include every moved node.
- **Stale closures**: Handler callbacks are memoized and receive changing node arrays. Use refs or carefully maintained dependencies so a transaction does not compare against stale pre-drag data.
- **Interleaved gestures**: A second gesture must not overwrite an active transaction. Guard against duplicate starts and finalize/cancel stale state on unmount or tool/project changes.
- **Undo during an active gesture**: Disable/ignore undo until the active gesture finalizes, or cancel the transaction before undo. Do not allow the UI to display a history state inconsistent with live nodes.
- **Autosave volume**: Keep immediate scene save at gesture completion; do not introduce a network request for every drag point.
- **Resize callbacks**: Existing `handleResize` is used for both intermediate and final resize updates in some paths. Verify the actual `NodeResizer` callback contract before choosing the exact start/end hook.
- **Arrow pointer release**: Pointer capture and release outside the node must still finalize or cancel cleanly; avoid leaving the store in an active transaction.
- **Project switching**: Clear any active gesture transaction when `currentProjectId` changes.
- **Scope creep into text editing**: Text inputs emit per-keystroke data changes. Keep text-edit history semantics separate unless product requirements explicitly ask for atomic text editing too.

## Rollback Plan

- Revert the transaction API and lifecycle wiring while retaining the existing `commitWorkbenchHistory` implementation.
- If resize or arrow-handle expansion is unstable, ship the position-drag fix independently and defer those gesture adapters behind separate commits.
- Verify that removing an active transaction does not leave `workbenchHistoryIndex`, `projectNodes`, or the immediate-save path out of sync.
