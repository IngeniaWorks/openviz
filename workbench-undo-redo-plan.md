# Plan: Workbench Undo/Redo Actions

**Generated**: 2026-04-21

## Overview
Implement a dedicated undo/redo system for Workbench mode so toolbar buttons and Workbench keyboard shortcuts operate on `workbenchNodes` and `connections` instead of Studio `project` history.

## Prerequisites
- Existing Zustand store slices (`workbenchSlice`, `historySlice`)
- Workbench toolbar and keyboard shortcut hooks
- Lint command (`npm run lint`)

## Dependency Graph

```text
T1 ──┬── T3 ──┐
     │        ├── T5
T2 ──┘        │
T4 ───────────┘
```

## Tasks

### T1: Define Workbench History State
- **depends_on**: []
- **location**: `src/store/storeTypes.ts`, `src/store/slices/workbenchSlice.ts`
- **description**: Add Workbench-specific snapshot types/state (`workbenchHistory`, `workbenchHistoryIndex`) and public actions (`undoWorkbench`, `redoWorkbench`) to the store contracts.
- **validation**: TypeScript accepts new fields/actions and no interface mismatches remain.
- **status**: Not Completed
- **log**:
- **files edited/created**:

### T2: Design Snapshot/Commit Helpers
- **depends_on**: []
- **location**: `src/store/slices/workbenchSlice.ts`
- **description**: Add internal helpers to capture snapshots of Workbench graph state, compare snapshots, trim history length, and apply updates with history commits.
- **validation**: Helper unit behavior is represented in code flow: no-op updates avoid duplicate snapshots and history is capped.
- **status**: Not Completed
- **log**:
- **files edited/created**:

### T3: Apply History Commits to Mutations
- **depends_on**: [T1, T2]
- **location**: `src/store/slices/workbenchSlice.ts`
- **description**: Route Workbench graph mutations (add/update/remove/reorder/duplicate/paste/connect/set nodes+connections/freehand undo) through commit helpers so each meaningful change produces an undoable snapshot.
- **validation**: Undo can step backward through recent Workbench changes and redo can step forward.
- **status**: Not Completed
- **log**:
- **files edited/created**:

### T4: Wire UI and Keyboard to Workbench Undo/Redo
- **depends_on**: [T1]
- **location**: `src/components/workbench/hooks/useWorkbenchStore.ts`, `src/components/workbench/hooks/useWorkbench.ts`, `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts`, `src/components/workbench/workbench.tsx`
- **description**: Expose `undoWorkbench`/`redoWorkbench` via hooks, wire toolbar buttons to these actions, and add Ctrl/Cmd+Z, Shift+Cmd+Z/Ctrl+Y in Workbench keyboard shortcuts.
- **validation**: Toolbar + keyboard both call Workbench actions, not Studio history actions.
- **status**: Not Completed
- **log**:
- **files edited/created**:

### T5: Verify and Regression Check
- **depends_on**: [T3, T4]
- **location**: repo root (`npm run lint`) and manual Workbench flow
- **description**: Run lint, verify Select tool remains present, and smoke-test undo/redo across key operations (move, add, delete, connect).
- **validation**: Lint passes and Workbench undo/redo behavior is confirmed.
- **status**: Not Completed
- **log**:
- **files edited/created**:

## Parallel Execution Groups

| Wave | Tasks | Can Start When |
|------|-------|----------------|
| 1 | T1, T2 | Immediately |
| 2 | T3, T4 | T1 and T2 complete (T4 needs T1 only) |
| 3 | T5 | T3 and T4 complete |

## Testing Strategy
- Run `npm run lint`
- Manual Workbench smoke test:
  - add node -> undo/redo
  - move node -> undo/redo
  - connect/disconnect -> undo/redo
  - delete -> undo/redo
  - freehand stroke + freehand undo -> undo/redo

## Risks & Mitigations
- Risk: Duplicate snapshots from repeated no-op updates.
  - Mitigation: Skip commits when snapshot unchanged.
- Risk: History grows too large in long sessions.
  - Mitigation: Cap Workbench history size.
- Risk: Studio undo/redo confusion remains.
  - Mitigation: Keep Studio history untouched and only wire Workbench UI/shortcuts to Workbench actions.
