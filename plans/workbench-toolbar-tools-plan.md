# Plan: Workbench Toolbar Tools

**Generated**: 2026-04-21
**Estimated Complexity**: High

## Overview
Implement a React Flow-first workbench toolbar with tools in this order: Select, Hand, Draw, Eraser, Arrow, Text, Note, Media.

Confirmed behavior:
- Shortcuts: `V/H/D/E/A/T/N/M`
- Multi-select: default React Flow (`Cmd/Ctrl+Click`) + `Shift+Drag` box select
- Hand tool: pan-only, disables selection/drag while active
- Draw/Eraser: sticky tools (remain active until switched)
- Arrow/Text/Note/Media: one-shot tools; after creation they auto-switch to Select and select the new node
- Media Upload: image-only file picker (no video)
- Upload from phone: placeholder action
- Create new submenu: reuse existing `sketchFormats`
- Arrow/Text/Note nodes: non-connectable in v1
- Text/Note edit mode: double-click to edit, single-click selects node

Approach:
- Introduce unified `activeWorkbenchTool` in Zustand workbench slice.
- Drive React Flow interaction props from that mode.
- Add custom node types for Arrow/Text/Note/Media.
- Implement curved Arrow node with draggable endpoints + midpoint control (this is feasible with custom node controls and path recomputation).

## Prerequisites
- Existing React Flow setup in `src/components/workbench/workbench.tsx`
- Zustand workbench slice in `src/store/slices/workbenchSlice.ts`
- Existing `DrawingOverlay` draw/erase flow
- Node mapping in `src/components/workbench/hooks/useWorkbenchGraph.ts`

## Documentation Baseline (Context7)
- React Flow selection defaults and key props (`selectionKeyCode`, `multiSelectionKeyCode`)
- React Flow viewport interaction props (`panOnDrag`, `selectionOnDrag`, `nodesDraggable`, `elementsSelectable`)
- Custom nodes and `NodeResizer`; `nodrag` for embedded inputs

## Sprint 1: Tool State + Interaction Modes
**Goal**: Establish mode architecture and toolbar UI in required order with keyboard shortcuts.

**Demo/Validation**:
- Toolbar order is exact.
- Tool switching works via click + keyboard.
- Select mode supports multi-select and drag selection.
- Hand mode pans only.
- Draw/Eraser remain active until switched.

### Task 1.1: Add dedicated workbench tool type + state
- **Location**: `src/types/index.ts`, `src/store/slices/workbenchSlice.ts`, `src/store/storeTypes.ts`, `src/components/workbench/hooks/useWorkbenchStore.ts`
- **Description**: Add `WorkbenchToolType = 'select' | 'hand' | 'draw' | 'eraser' | 'arrow' | 'text' | 'note' | 'media'` and store actions (`setActiveWorkbenchTool`).
- **Dependencies**: None
- **Acceptance Criteria**:
  - Single source of truth replaces ad-hoc draw/eraser toggles.
  - Exposed via workbench hooks.
- **Validation**:
  - `npx tsc --noEmit`

### Task 1.2: Refactor WorkbenchToolbar to tool-driven contract
- **Location**: `src/components/workbench/WorkbenchToolbar.tsx`, `src/components/workbench/workbench.tsx`
- **Description**: Replace current draw/eraser-only controls with full toolstrip + media submenu (`Upload`, `Upload from phone`, `Create new > sizes`).
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Tool UI in requested order.
  - Active state styling and submenu close behavior are correct.
- **Validation**:
  - Manual check in `npm run dev`

### Task 1.3: Bind React Flow props by tool mode
- **Location**: `src/components/workbench/workbench.tsx`
- **Description**: Configure `panOnDrag`, `selectionOnDrag`, `nodesDraggable`, `elementsSelectable`, `selectionMode` based on active tool.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Select mode: selection + node drag enabled.
  - Hand mode: pan-only, selection/drag disabled.
  - Draw/Eraser: overlay active, node interaction minimized.
- **Validation**:
  - Manual interaction matrix pass

### Task 1.4: Add tool keyboard shortcuts
- **Location**: `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts`, `src/components/workbench/hooks/useWorkbench.ts`
- **Description**: Add `V/H/D/E/A/T/N/M` mode keys while preserving existing shortcuts.
- **Dependencies**: Tasks 1.1, 1.3
- **Acceptance Criteria**:
  - Shortcuts ignored in inputs/textarea/contenteditable.
  - Existing copy/paste/duplicate/delete/reorder shortcuts unchanged.
- **Validation**:
  - Hook tests + manual keyboard smoke test

## Sprint 2: New Node Types + Creation Flows
**Goal**: Add Arrow/Text/Note/Media nodes with selection and scaling.

**Demo/Validation**:
- All new node types place, select, drag, resize.
- Text/Note edit on double-click.
- One-shot tool auto-return to Select and newly created node is selected.

### Task 2.1: Extend node domain types
- **Location**: `src/types/index.ts`
- **Description**: Add node types/interfaces:
  - `arrow`: `{ start, end, control, strokeColor, strokeWidth }`
  - `text`: `{ text, fontSize, color }`
  - `note`: `{ text, colorVariant }`
  - `media`: `{ src, alt, mimeType }`
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `WorkbenchNode` union updated and strongly typed.
- **Validation**:
  - `npx tsc --noEmit`

### Task 2.2: Implement ArrowNode with endpoint + curve control
- **Location**: `src/components/nodes/ArrowNode.tsx`
- **Description**: Render curved arrow path (quadratic Bezier) with draggable start endpoint, end endpoint, and midpoint control point in node-local coordinates.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Dragging endpoints/control updates arrow geometry.
  - Node remains selectable/resizable.
  - Selected visual affordances are clear.
- **Validation**:
  - Manual interaction checks for control dragging + resize behavior

### Task 2.3: Implement TextNode and NoteNode
- **Location**: `src/components/nodes/TextNode.tsx`, `src/components/nodes/NoteNode.tsx`
- **Description**: Add editable nodes with `NodeResizer`; inputs use `nodrag` and open edit mode on double-click.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Text node transparent by default.
  - Enter creates multiline text.
  - Note node styled like sticky note with subtle shadow.
- **Validation**:
  - Manual edit/drag/resize checks

### Task 2.4: Implement MediaNode (image-only preview)
- **Location**: `src/components/nodes/MediaNode.tsx`
- **Description**: Render image preview node with selection/resizer and fallback when image cannot load.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Displays uploaded image.
  - Non-connectable in v1.
- **Validation**:
  - Manual upload/render check

### Task 2.5: Register new node types in graph + flow
- **Location**: `src/components/workbench/workbench.tsx`, `src/components/workbench/hooks/useWorkbenchGraph.ts`
- **Description**: Add nodeType mapping and sizing/data wiring for new nodes.
- **Dependencies**: Tasks 2.2-2.4
- **Acceptance Criteria**:
  - All nodes render without mapping errors.
- **Validation**:
  - Workbench loads mixed node set cleanly

### Task 2.6: Add creation actions and one-shot behavior
- **Location**: `src/store/slices/workbenchSlice.ts`, `src/components/workbench/hooks/useWorkbench.ts`, `src/components/workbench/workbench.tsx`
- **Description**:
  - Arrow tool: click-drag to place arrow.
  - Text/Note tool: click pane to place node.
  - Media upload: file picker creates media node.
  - Auto-switch to Select for Arrow/Text/Note/Media after placement.
- **Dependencies**: Tasks 2.1-2.5
- **Acceptance Criteria**:
  - New node auto-selected after creation.
  - Hand/Draw/Eraser remain sticky.
- **Validation**:
  - Manual per-tool creation pass

## Sprint 3: Media Submenu + Hardening + Tests
**Goal**: Finalize media UX and de-risk regressions.

**Demo/Validation**:
- Media submenu works end-to-end.
- Upload from phone shows clear placeholder action.
- Existing draw/erase behavior remains stable.

### Task 3.1: Implement image-only Upload action
- **Location**: `src/components/workbench/WorkbenchToolbar.tsx`, `src/components/workbench/workbench.tsx`
- **Description**: Add hidden input (`accept="image/*"`) and create media node from selected file (`URL.createObjectURL` in v1).
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - File dialog opens from submenu.
  - Selected image creates media node at sensible viewport position.
- **Validation**:
  - Manual upload tests for JPG/PNG/WebP

### Task 3.2: Implement Upload-from-phone placeholder
- **Location**: `src/components/workbench/WorkbenchToolbar.tsx`
- **Description**: Disabled action or toast indicating upcoming support; non-breaking UX.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - User feedback is explicit.
  - No runtime errors.
- **Validation**:
  - Manual interaction check

### Task 3.3: Reuse Create New size submenu
- **Location**: `src/components/workbench/WorkbenchToolbar.tsx`, `src/components/workbench/hooks/useWorkbenchFormatMenu.ts`
- **Description**: Rewire existing format creation under Media > Create new.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing `sketchFormats` flow preserved.
- **Validation**:
  - Manual sketch creation by size

### Task 3.4: Add/extend tests
- **Location**: `src/components/workbench/hooks/*.test.ts`, `src/components/nodes/*.test.tsx`
- **Description**: Add coverage for tool switching, one-shot vs sticky behavior, arrow geometry updates, and media upload handler logic.
- **Dependencies**: Prior tasks
- **Acceptance Criteria**:
  - Relevant test suites pass.
- **Validation**:
  - `npm test`

### Task 3.5: Refactor oversized files early
- **Location**: `src/components/workbench/workbench.tsx`, `src/store/slices/workbenchSlice.ts`, new hook files
- **Description**: Extract mode/creation/media logic into hooks/services to reduce complexity and align with AGENTS architecture.
- **Dependencies**: All prior tasks
- **Acceptance Criteria**:
  - New logic split into focused files.
  - Existing files avoid further uncontrolled growth.
- **Validation**:
  - Code review + static checks

## Testing Strategy
- Type safety gate: `npx tsc --noEmit`
- Unit/hook tests for shortcut and mode transitions
- Manual integration checklist:
  - Select/multi-select behavior
  - Hand panning behavior
  - Draw/Eraser persistence
  - Arrow endpoint/control editing
  - Text/Note editing and resize
  - Media image upload flow
- Regression checks for existing node types and existing clipboard/layer-order shortcuts

## Potential Risks & Gotchas
- `src/store/slices/workbenchSlice.ts` and `src/components/workbench/workbench.tsx` are already over size guideline and should be split while implementing.
- Arrow control dragging inside React Flow requires careful event handling to avoid node drag conflicts (must use `nodrag` and controlled pointer handlers).
- If arrow geometry is stored in node-local coordinates, resizing must re-normalize endpoints/control to avoid distortion bugs.
- `URL.createObjectURL` needs cleanup strategy to avoid memory leaks if nodes are removed frequently.

## Rollback Plan
- Keep commits atomic by sprint task.
- If mode refactor regresses behavior:
  - revert to prior draw/eraser mode wiring,
  - gate new tools behind inactive toolbar actions,
  - keep new node components unregistered until stable.
- Maintain checkpoint tags/commits per sprint for selective rollback.
