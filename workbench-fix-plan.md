# Plan: Workbench White Background, Connection Robustness, and Node Deduplication

**Generated**: 2026-03-02

## Overview
This plan updates workbench visuals and connection behavior with strict, deterministic graph rules:
- White workbench background with tuned grid and edge contrast.
- Strict allowed edges: `image -> animate|render` only.
- No `video` connectivity (no source connector and policy-level block).
- Generated `image`/`video` result nodes remain standalone (no auto output edges).
- Remove duplicate workbench wrapper node components and use canonical node components in `src/components/nodes`.
- Enforce policy on both write-time (`addConnection`) and ingest-time (`setConnections` / streamed snapshots) so invalid edges cannot re-enter state.

## Prerequisites
- Node/npm environment that can run `npm test`, `npm run lint`, `npm run build`.
- Familiarity with `@xyflow/react` connection lifecycle and handles.
- Familiarity with Zustand action patterns and immutable updates.

## Dependency Graph

```text
T1 ──┬── T3 ──┬── T5 ──┬── T10 ── T11
     │         │        │
     │         │        ├── T7 ──┤
     │         │        ├── T8 ──┤
     │         │        └── T6 ──┤
     │         │
     │         └── T4 ───────────┘
T2 ──┘
T9 ───────────────────────────────┘
```

## Tasks

### T1: Baseline Current Connection/Data Paths
- **depends_on**: []
- **location**:
  - `src/components/workbench/workbench.tsx`
  - `src/components/workbench/hooks/useWorkbench.ts`
  - `src/components/workbench/ImageNode.tsx`
  - `src/components/workbench/VideoNode.tsx`
  - `src/components/workbench/AnimateNode.tsx`
  - `src/components/workbench/RenderNode.tsx`
  - `src/components/nodes/hooks/useAnimateNodeActions.ts`
  - `src/components/nodes/hooks/useRenderNodeGeneration.ts`
  - `src/store/slices/workbenchSlice.ts`
- **description**:
  - Capture all `addConnection(...)`, `setConnections(...)`, and connection-ingestion paths.
  - Confirm duplicate wrapper usage and `nodeTypes` mappings.
  - Record existing auto output edge behavior in animate/render generation.
- **validation**:
  - Inventory includes all write/ingest edge paths and wrapper->canonical mapping.
- **status**: Completed
- **log**:
  - Audited all connection write paths: `addConnection` in store, `handleConnect` and reverse-drag `onConnectEnd` in `useWorkbench`.
  - Audited ingest paths: `setConnections` usage in project page hydration and SSE scene stream hook.
  - Confirmed duplicate wrapper node usage (`WorkbenchAnimateNode`, `WorkbenchRenderNode`) and existing `nodeTypes` mappings.
  - Confirmed animate/render generation hooks were creating parent->result edges.
- **files edited/created**:
  - `workbench-fix-plan.md`

### T2: Documentation Alignment (Context7)
- **depends_on**: []
- **location**:
  - Context7 docs: `/xyflow/xyflow`, `/pmndrs/zustand`
- **description**:
  - Confirm modern guidance for connection validation and immutable state updates.
  - Use as basis for pure policy module + minimal slice delegation.
- **validation**:
  - Plan and implementation notes reference doc-aligned patterns for validation placement and state updates.
- **status**: Completed
- **log**:
  - Pulled Context7 guidance from `/xyflow/xyflow` and `/pmndrs/zustand`.
  - Aligned implementation to docs: connection acceptance centralized in policy logic; store actions remain immutable and thin.
- **files edited/created**:
  - `workbench-fix-plan.md`

### T3: Deduplicate Animate/Render Node Wiring
- **depends_on**: [T1]
- **location**:
  - `src/components/workbench/workbench.tsx`
  - `src/components/workbench/AnimateNode.tsx` (delete)
  - `src/components/workbench/RenderNode.tsx` (delete)
  - `src/components/nodes/AnimateNode.tsx`
  - `src/components/nodes/RenderNode.tsx`
- **description**:
  - Remove workbench wrapper duplicates and map `nodeTypes` directly to canonical components.
  - Keep one handle implementation per node type.
- **validation**:
  - Build passes with direct canonical imports.
  - `rg` confirms zero references to deleted wrapper files/symbols.
- **status**: Completed
- **log**:
  - Mapped workbench `nodeTypes` directly to canonical `src/components/nodes/AnimateNode` and `RenderNode`.
  - Deleted wrapper components `src/components/workbench/AnimateNode.tsx` and `src/components/workbench/RenderNode.tsx`.
  - Verified wrapper symbols no longer referenced.
- **files edited/created**:
  - `src/components/workbench/workbench.tsx`
  - `src/components/workbench/AnimateNode.tsx` (deleted)
  - `src/components/workbench/RenderNode.tsx` (deleted)

### T4: Implement Central Connection Policy Module
- **depends_on**: [T1, T2]
- **location**:
  - `src/services/workbench/connectionPolicy.ts` (new)
- **description**:
  - Create pure helpers for connection acceptance and normalization with deterministic behavior:
    - allow only `image -> animate|render`
    - reject any `video` source/target
    - reject self-connections
    - reject duplicates (`from + to`)
    - reject orphan connections where `from` or `to` node is missing
    - enforce inbound caps:
      - animate max 2 inbound
      - render max 1 inbound
      - on overflow, replace oldest inbound deterministically
  - Deterministic rule: oldest is first match in persisted `connections` order after normalization.
- **validation**:
  - Policy tests prove deterministic replacement and all reject/allow rules.
- **status**: Completed
- **log**:
  - Added pure policy module with deterministic rules for allow/reject, duplicate/orphan/self/video rejection, and inbound caps.
  - Implemented deterministic oldest-first inbound replacement by persisted connection order.
- **files edited/created**:
  - `src/services/workbench/connectionPolicy.ts`
  - `src/services/workbench/connectionPolicy.test.ts`

### T5: Enforce Policy on New Connections (Store + Connect Handlers)
- **depends_on**: [T3, T4]
- **location**:
  - `src/store/slices/workbenchSlice.ts`
  - `src/components/workbench/hooks/useWorkbench.ts`
- **description**:
  - Replace unconditional append in `addConnection` with policy-gated insertion.
  - Keep `onConnect` and `onConnectEnd` routed through store action only.
  - Preserve target-handle-to-image reverse drag UX while policy-gated.
  - Keep slice edits minimal (delegate logic to policy module; avoid expanding large slice logic).
- **validation**:
  - Invalid edges are rejected through both drag and programmatic add paths.
  - Reverse-drag flow still creates valid `image -> animate|render` edges.
- **status**: Completed
- **log**:
  - Replaced unconditional append in `addConnection` with `addConnectionWithPolicy(...)`.
  - Preserved `useWorkbench` connect + reverse-drag flow and kept all edge creation routed through store action.
- **files edited/created**:
  - `src/store/slices/workbenchSlice.ts`
  - `src/components/workbench/hooks/useWorkbench.ts` (verified no direct edge mutation changes required)

### T6: Enforce Policy on Ingested Connections (`setConnections` / Streamed Scene)
- **depends_on**: [T4]
- **location**:
  - `src/store/slices/workbenchSlice.ts`
  - Any scene ingest path that calls `setConnections` (workbench stream hooks/services)
- **description**:
  - Apply normalization/sanitization when replacing connection arrays from scene snapshots/stream events.
  - Ensure ingest cannot reintroduce invalid `video`, duplicate, self, orphan, or over-cap edges.
- **validation**:
  - Loading malformed connection payload results in normalized, policy-compliant store state.
- **status**: Completed
- **log**:
  - Updated `setConnections` to sanitize/normalize incoming payloads with the same policy module used for writes.
  - Confirmed project page hydration and scene streaming both flow through `setConnections`, closing ingest bypass.
- **files edited/created**:
  - `src/store/slices/workbenchSlice.ts`
  - `src/components/workbench/hooks/useSceneStream.ts` (verified ingest path)
  - `src/app/projects/[id]/page.tsx` (verified ingest path)

### T7: Remove Video Source Connector (UI) and Keep Video Standalone
- **depends_on**: [T3, T4]
- **location**:
  - `src/components/workbench/VideoNode.tsx`
- **description**:
  - Remove video source handle and source-click affordance.
  - Keep video preview/playback/fullscreen/resizing behavior unchanged.
  - Note: UI removal is not security/policy enforcement; policy enforcement remains in T5/T6.
- **validation**:
  - Video node has no source connector in UI.
  - Programmatic attempts to connect video are rejected by policy tests.
- **status**: Completed
- **log**:
  - Removed video source `Handle` and source-click affordance from workbench video node UI.
  - Preserved playback/fullscreen/resizer behavior.
  - Policy tests cover and reject programmatic video endpoint connections.
- **files edited/created**:
  - `src/components/workbench/VideoNode.tsx`
  - `src/services/workbench/connectionPolicy.test.ts`

### T8: Remove Auto Output Edges from Animate/Render Generation
- **depends_on**: [T4]
- **location**:
  - `src/components/nodes/hooks/useAnimateNodeActions.ts`
  - `src/components/nodes/hooks/useRenderNodeGeneration.ts`
- **description**:
  - Remove auto edge creation from generation hooks.
  - Keep result node creation and status/project updates unchanged.
  - Generated `image`/`video` nodes remain disconnected by default.
- **validation**:
  - Generation produces standalone result nodes with no new parent->result edges.
- **status**: Completed
- **log**:
  - Removed auto-created output edges in animate generation hook.
  - Removed auto-created output edges in render generation hook.
  - Result nodes are still created and updated, now disconnected by default.
- **files edited/created**:
  - `src/components/nodes/hooks/useAnimateNodeActions.ts`
  - `src/components/nodes/hooks/useRenderNodeGeneration.ts`

### T9: White Workbench Background + Contrast Adjustments
- **depends_on**: []
- **location**:
  - `src/components/workbench/workbench.tsx`
  - `src/components/workbench/CustomEdge.tsx` (if edge contrast tuning needed)
- **description**:
  - Switch workbench container to white.
  - Remove dark radial overlay.
  - Tune dot-grid and edge contrast for readability on white.
- **validation**:
  - White canvas renders correctly.
  - Grid and connection edges are clearly visible on white.
- **status**: Completed
- **log**:
  - Switched workbench container to white and removed dark radial overlay.
  - Tuned grid dot colors for readability on white.
  - Tuned non-selected edge stroke to slate (`#475569`) for cleaner contrast on white.
- **files edited/created**:
  - `src/components/workbench/workbench.tsx`
  - `src/components/workbench/CustomEdge.tsx`

### T10: Expand Robustness Tests (Policy + Store + Critical UX)
- **depends_on**: [T5, T6, T7, T8, T9]
- **location**:
  - `src/store/workbenchConnections.test.ts`
  - Optional new: `src/services/workbench/connectionPolicy.test.ts`
  - Optional: hook-level tests for generation behavior if feasible
- **description**:
  - Add/adjust tests for:
    - valid `image -> animate` inbound (max 2) with deterministic replacement on third
    - valid `image -> render` inbound (max 1) with deterministic replacement on second
    - reject self, duplicate, invalid direction, and any `video` endpoint
    - reject orphan endpoints (missing nodes)
    - normalization for `setConnections` payloads (drop/fix invalid entries)
    - swap-frame behavior remains deterministic (exactly two inbound, reversed order)
    - no auto output edges after animate/render generation
- **validation**:
  - Tests pass and cover all policy invariants and critical UX-preservation behavior.
- **status**: Completed
- **log**:
  - Added dedicated policy unit tests for allow/reject/cap/normalize rules.
  - Rewrote store-level connection tests to verify add-path and `setConnections` normalization behavior.
  - Added deterministic swap-frame regression test (remove/re-add order preserved under policy).
  - Added/updated node hook tests to verify animate/render generation creates standalone nodes (no output-edge `addConnection`).
  - Verified targeted suites pass.
- **files edited/created**:
  - `src/services/workbench/connectionPolicy.test.ts`
  - `src/store/workbenchConnections.test.ts`
  - `src/components/nodes/AnimateNode.test.tsx`
  - `src/components/nodes/RenderNode.test.tsx`

### T11: Final Verification and Manual Regression Sweep
- **depends_on**: [T10]
- **location**:
  - Repository-wide checks and manual workbench smoke flow
- **description**:
  - Run:
    - `npm test`
    - `npm run lint`
    - `npm run build`
  - Manual smoke checklist:
    - white workbench appearance
    - edge visibility/contrast on white
    - direct `image -> animate|render` works
    - reverse-drag from animate/render target to image still works and is policy-gated
    - video has no source connector and cannot connect
    - generated outputs are disconnected
- **validation**:
  - All commands pass and smoke checklist is complete.
- **status**: Completed (manual smoke partially deferred)
- **log**:
  - Ran `npm test -- src/services/workbench/connectionPolicy.test.ts src/store/workbenchConnections.test.ts src/components/nodes/AnimateNode.test.tsx src/components/nodes/RenderNode.test.tsx` (pass: 4 files, 14 tests).
  - Ran `npm test` (pass: 8 files, 27 tests).
  - Ran `npm run lint` (pass).
  - Ran `npm run build` (pass; non-blocking Next.js warnings and EPERM AggregateError logs observed during static generation, build completed successfully).
  - Manual UI smoke checklist not fully executed in this terminal-only pass.
- **files edited/created**:
  - `workbench-fix-plan.md`

## Parallel Execution Groups

| Wave | Tasks | Can Start When |
|------|-------|----------------|
| 1 | T1, T2, T9 | Immediately |
| 2 | T3, T4 | T1 complete (T4 also needs T2) |
| 3 | T5, T6, T7, T8 | T4 complete (T5 and T7 also need T3) |
| 4 | T10 | T5, T6, T7, T8, T9 complete |
| 5 | T11 | T10 complete |

## Testing Strategy
- Unit test pure policy behavior (allow/reject, cap replacement, deterministic ordering).
- Store-level tests for both add path and ingest (`setConnections`) normalization.
- Regression checks for reverse-drag UX and swap-frames behavior.
- Visual/manual checks for white-canvas readability and edge contrast.
- Final full test/lint/build gate.

## Risks & Mitigations
- **Risk**: Ingest path bypasses `addConnection` and reintroduces invalid edges.
  - **Mitigation**: Normalize in `setConnections`/stream ingest using the same policy module.
- **Risk**: Non-deterministic replacement causes flaky behavior after reload/merge.
  - **Mitigation**: Define explicit oldest-first rule by persisted order and test after normalization.
- **Risk**: Removing wrappers breaks handle behavior or leaves dead imports.
  - **Mitigation**: Direct canonical mapping + `rg` cleanup criteria + build gate.
- **Risk**: `workbenchSlice.ts` size (717 lines) increases regression risk.
  - **Mitigation**: Keep slice changes minimal and delegate all policy logic to service module.
- **Risk**: White background reduces readability.
  - **Mitigation**: Explicit contrast validation for both grid and edges in T9/T11.
