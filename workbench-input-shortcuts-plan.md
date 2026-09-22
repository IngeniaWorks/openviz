# Plan: Workbench Input and Shortcut Model

**Generated**: 2026-09-21  
**Estimated Complexity**: Medium-High

## Overview

Replace the Workbench hand-drag interaction with direct middle-mouse canvas panning, make empty-canvas clicks clear selection, make Shift the consistent multi-select modifier, and align keyboard shortcuts with the proposed Workbench workflow.

The implementation should keep React Flow as the interaction engine, but remove the user-facing `hand` tool and its mode-specific drag behavior. Keyboard behavior should be centralized in the existing `useWorkbenchKeyboardShortcuts` hook and shortcut map. Selection and pan behavior should be expressed through React Flow props and small, testable event/shortcut helpers rather than duplicated in components.

Proposed final interaction model:

| Action | Interaction |
|---|---|
| Enter 2D Studio | Double-click an editable image/media item |
| Text tool | `T` |
| Create Modify node from selected images | `Q` |
| Pan canvas | Middle mouse drag, two-finger trackpad scroll, or arrow keys |
| Zoom canvas | Pinch outward zooms in; pinch inward zooms out |
| Escape / cancel | Close the topmost modal or popup, cancel transient interaction, then clear selection when appropriate |
| Clear selection | Click empty canvas background |
| Multi-select | Hold `Shift` while clicking items |
| Bring to front | `]` |
| Bring to back | `[` |

Existing undo/redo, copy/paste, duplicate, delete, node creation, connection, wheel zoom, context menu, and drawing behavior should remain available unless the input-normalization review identifies a direct conflict.

## Recommended Shortcut Reference

| Shortcut | Action | Status |
|---|---|---|
| `T` | Activate Text tool | Requested; existing |
| `Q` | Create one Modify node connected to all selected images | Requested; new |
| `[` | Bring selected node to back | Requested; existing |
| `]` | Bring selected node to front | Requested; existing |
| `Arrow keys` | Pan canvas by a fixed screen-space step | Requested; new |
| `Middle mouse drag` | Pan canvas | Requested; new |
| `Two-finger trackpad movement` | Pan canvas | Requested; new |
| `Pinch outward` | Zoom in | Requested; new gesture handling |
| `Pinch inward` | Zoom out | Requested; new gesture handling |
| `+` / `=` | Zoom in | Recommended; new |
| `-` | Zoom out | Recommended; new |
| `Escape` | Close topmost modal/menu, cancel transient interaction, then clear selection | Requested; new unified behavior |
| `Shift + 1` | Zoom to fit | Recommended; new |
| `Shift + 0` | Zoom to 100% | Recommended; new |
| `Shift + R` | Reset viewport | Recommended; new; do not use Escape |
| `Ctrl/Cmd + Z` | Undo | Existing |
| `Ctrl/Cmd + Shift + Z` | Redo | Recommended primary redo binding |
| `Ctrl/Cmd + Y` | Redo | Existing compatibility binding |
| `Delete` / `Backspace` | Delete selected nodes | Existing |
| `Ctrl/Cmd + C` | Copy | Existing |
| `Ctrl/Cmd + V` | Paste | Existing |

`Escape` must not reset zoom or viewport position. The implementation should preserve both `Ctrl/Cmd + Shift + Z` and `Ctrl/Cmd + Y` for redo compatibility.

## Prerequisites

- `Q` is a Workbench action: create a Modify node, then connect every currently selected image node to it. The Modify node should behave like the existing Render node while showing a mini preview of the connected image in its prompt area, similar to the Video node.
- Arrow-key panning uses a fixed screen-space step for predictable movement at every zoom.
- Empty-canvas double-click should do nothing; only double-clicking an editable image/media item enters 2D Studio.
- Trackpad gestures must be separated by intent: two-finger translation pans, while pinch-out zooms in and pinch-in zooms out. Browser trackpads may expose pinch as modified wheel events rather than React Flow touch events.
- No dependency installation is expected. React Flow `^12.10.0` supports `panOnDrag`, `panOnScroll`, `zoomOnScroll`, `zoomOnPinch`, `multiSelectionKeyCode`, and `selectionKeyCode`.

## Sprint 1: Remove Hand Mode and Establish Pointer Semantics

**Goal**: Make selection mode the default Workbench interaction, remove hand drag from the UI/model, and support panning through middle-mouse drag, two-finger trackpad translation, and keyboard arrows while preserving pinch zoom.

**Demo/Validation**:
- The toolbar no longer displays a Hand tool.
- Left-button dragging on empty canvas does not pan; it retains React Flow selection behavior.
- Middle-button dragging pans the canvas in every applicable Workbench tool mode without selecting or moving nodes.
- Two-finger trackpad movement pans the canvas horizontally and vertically.
- Pinching two fingers apart zooms in; pinching them together zooms out.
- Right-click context menus, node dragging, connecting, drawing, erasing, and arrow creation still work.

### Task 1.1: Remove the Workbench hand tool from the type and shortcut configuration
- **Location**: `src/types/index.ts`, `src/store/workbenchTools.ts`, `src/components/workbench/WorkbenchToolbar.tsx`
- **Description**: Remove `hand` from `WorkbenchToolType`, remove its icon/configuration and `H` binding, and update any exhaustive switch/set declarations or persisted-state handling that refer to the tool.
- **Dependencies**: None.
- **Acceptance Criteria**:
  - TypeScript no longer permits `hand` as a Workbench tool.
  - The toolbar exposes no hand tool or hand shortcut.
  - Pressing `H` does not activate a Workbench tool.
  - Existing tool shortcuts remain unchanged except where explicitly revised below.
- **Validation**: Update affected unit tests and run `pnpm exec vitest run src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.test.ts`; run `pnpm exec tsc --noEmit` if available through the project configuration.

### Task 1.2: Simplify mode-derived React Flow props
- **Location**: `src/components/workbench/hooks/workbenchModeProps.ts`, `src/components/workbench/hooks/workbenchModeProps.test.ts`
- **Description**: Remove hand-mode branching. Select mode should continue to enable selection, node dragging, and connecting. Creation/drawing modes should retain their current restrictions unless middle-button panning requires a shared pan configuration.
- **Dependencies**: Task 1.1.
- **Acceptance Criteria**:
  - No `isHand` logic remains.
  - No Workbench mode enables left-button pan as a substitute for the removed hand tool.
  - Tests describe the new contract rather than a hand-mode contract.
- **Validation**: Run the mode-props test file and the TypeScript check.

### Task 1.3: Configure mouse and trackpad viewport gestures
- **Location**: `src/components/workbench/workbench.tsx`, plus a viewport gesture helper/hook under `src/components/workbench/hooks/` if needed
- **Description**: Configure `panOnDrag` with the React Flow mouse-button array for the middle button. Add a scroll/gesture path for two-finger trackpad translation and preserve pinch direction semantics: outward pinch zooms in and inward pinch zooms out. Normalize browser event data through a testable helper.
- **Dependencies**: Task 1.2.
- **Acceptance Criteria**:
  - Middle mouse (`button === 1`) pans the viewport horizontally and vertically.
  - Two-finger translation pans without changing zoom.
  - Pinch-out increases zoom and pinch-in decreases zoom.
  - Primary-button node dragging and selection are not regressed.
  - Pan gestures do not create arrows, text, notes, or other one-shot nodes.
  - Browser context-menu behavior remains intentional for right-click.
- **Validation**: Add pure tests for normalized pan/zoom gesture deltas; verify middle mouse, two-finger pan, pinch-in, and pinch-out on macOS.

### Task 1.4: Normalize canvas cursor and interaction affordances
- **Location**: `src/components/workbench/workbench.tsx` and relevant Tailwind classes/assets
- **Description**: Remove hand-tool cursor states and use a neutral/select cursor plus a middle-pan affordance where practical. Do not add inline styles; use Tailwind classes or existing React Flow class hooks.
- **Dependencies**: Task 1.3.
- **Acceptance Criteria**:
  - The UI does not imply that a hand tool is required for panning.
  - Cursor states do not claim that left-button drag pans the canvas.
  - Overlay chrome remains pointer-safe and does not block middle-button canvas gestures.
- **Validation**: Manual desktop mouse test at normal and zoomed viewport positions.

## Sprint 2: Selection and Keyboard Navigation

**Goal**: Make selection behavior match the requested model and add consistent keyboard navigation/actions.

**Demo/Validation**:
- Clicking empty canvas clears all selected items and active-item state.
- Clicking an item selects it normally; Shift-clicking adds/toggles items without clearing the existing selection.
- Arrow keys pan the canvas when the Workbench has focus and do not fire while typing in inputs, textareas, or contenteditable nodes.
- `[` and `]` reorder the active/selected item as before.

### Task 2.1: Make Shift the multi-selection modifier
- **Location**: `src/components/workbench/workbench.tsx`, `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`, related selection tests
- **Description**: Configure React Flow's multi-selection key to `Shift` and reconcile the current selection-change handler with React Flow's selected-node state so Shift-click preserves/adds/toggles items. Keep background clicks as the clear-selection path.
- **Dependencies**: Sprint 1.
- **Acceptance Criteria**:
  - Plain item click replaces the selection with that item.
  - Shift-click adds or toggles the item without losing other selected items.
  - Plain background click clears both `selectedNodeIds` and `activeNodeId` and closes selection-dependent menus.
  - Meta/Control are not required for multi-selection in the Workbench.
- **Validation**: Add/adjust handler-level tests for plain click, Shift-click, deselection, and pane click; verify with a browser multi-select scenario.

### Task 2.2: Add a testable viewport-pan keyboard action
- **Location**: `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts`, `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.test.ts`, `src/components/workbench/workbench.tsx`
- **Description**: Pass a React Flow viewport-pan callback into the shortcut hook and map `ArrowUp`, `ArrowDown`, `ArrowLeft`, and `ArrowRight` to fixed viewport translations. Use the current viewport and preserve zoom. Prevent default browser scrolling only when the Workbench is the active interaction surface.
- **Dependencies**: Task 2.1.
- **Acceptance Criteria**:
  - Each arrow key pans the canvas in the expected direction by one defined step.
  - Arrow-key pan does not change zoom or node positions.
  - Arrow keys do not intercept text editing, form inputs, menus, or other focused controls.
  - Holding an arrow key repeats smoothly enough for normal keyboard navigation without creating history entries.
- **Validation**: Unit-test direction and step calculations with a mocked viewport setter; add manual keyboard verification at multiple zoom levels.

### Task 2.3: Define Escape cancellation and selection clearing
- **Location**: `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts`, Workbench menu/modal state hooks, `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.test.ts`
- **Description**: Make `Escape` follow normal UI cancellation semantics rather than resetting the viewport. Close the topmost open modal, popup, context menu, dropdown, or basic-block menu first; cancel active drawing/connection/editing interactions where applicable; then clear Workbench selection when no higher-priority transient UI consumes the event. Coordinate with Radix components so Escape is not handled twice.
- **Dependencies**: Tasks 1.1 and 2.2.
- **Acceptance Criteria**:
  - Escape closes modal popups and menus before clearing the canvas selection.
  - Escape cancels active transient gestures/tools without moving or deleting nodes.
  - Escape clears all selected nodes and active-node state once no modal/menu owns the event.
  - Escape does not reset zoom or viewport position.
  - Text inputs and node editors retain their expected Escape behavior, with selection clearing only after the editor/modal has closed or relinquished focus.
- **Validation**: Add ordered-priority tests for modal, dropdown/context menu, active gesture, editor, and plain-canvas cases; manually verify keyboard focus return and screen-reader-visible dialog behavior.

### Task 2.4: Define the final shortcut registry and displayed labels
- **Location**: `src/store/workbenchTools.ts`, `src/components/workbench/WorkbenchToolbar.tsx`, any Workbench shortcut help UI
- **Description**: Make the shortcut registry the single source of truth for tool labels and keyboard bindings. Ensure `T` remains Text, `[` is Bring to back, `]` is Bring to front, and remove obsolete Hand documentation. Add `Q` as an action shortcut rather than a tool shortcut.
- **Dependencies**: Tasks 1.1 and 2.2.
- **Acceptance Criteria**:
  - Toolbar/tooltips and any shortcut help show the same final bindings.
  - No UI advertises `H` for Hand or a left-drag hand mode.
  - Modifier shortcuts (`Ctrl/Cmd+Z`, copy/paste, duplicate) continue to work.
- **Validation**: Update shortcut unit tests and grep the Workbench codebase for stale hand/shortcut labels.

## Sprint 3: 2D Studio Entry and Modify-Node Shortcut

**Goal**: Keep double-click as the 2D Studio entry point and make `Q` create the existing conceptual Modify block from all selected images.

**Demo/Validation**:
- Double-clicking an editable image/media node opens that node in 2D Studio.
- Double-clicking empty canvas does nothing; canvas double-click zoom is disabled.
- Pressing `Q` with one or more selected image nodes creates one Modify node and connects every selected image to it.
- Pressing `Q` with no selected images does nothing and does not interfere with typing.

### Task 3.1: Formalize the Modify node domain model
- **Location**: `src/types/index.ts`, `src/store/storeTypes.ts`, `src/store/slices/workbenchSlice.ts`, node registration in `src/components/workbench/workbench.tsx`
- **Description**: Add the Workbench Modify node type and data shape, based on the Render node's prompt/settings while carrying the connected image preview/source state needed by the UI. Decide whether the node is a distinct `modify` type or a Render-compatible subtype; prefer a distinct type if it has materially different rendering and future behavior.
- **Dependencies**: Sprint 2.
- **Acceptance Criteria**:
  - Modify nodes are represented without `any` or unsafe casts.
  - They can be persisted, restored, selected, moved, resized, deleted, duplicated, and synchronized like other Workbench nodes.
  - Existing connection policy accepts image-to-Modify connections and rejects invalid targets.
- **Validation**: Add type/fixture coverage, store lifecycle tests, and connection-policy tests.

### Task 3.2: Implement the Modify node view with connected-image mini preview
- **Location**: New `src/components/nodes/ModifyNode.tsx` plus focused tests; shared preview logic may be extracted from `VideoNode.tsx` or `RenderNode.tsx`
- **Description**: Build the Modify node as a Render-like prompt/control block with a mini preview area that resolves the connected image input, following the existing Video node preview pattern. Keep interactive fields protected with `nodrag`/`nowheel` behavior as appropriate.
- **Dependencies**: Task 3.1.
- **Acceptance Criteria**:
  - The node displays its prompt/settings and a preview for connected image input(s).
  - Multiple connected images have a deterministic preview policy (for example, first connection plus an input count or thumbnail strip) and do not crash when a source is missing.
  - Node editing does not trigger canvas pan, selection, or shortcut actions.
  - The node satisfies the repository's accessibility and Tailwind-only styling rules.
- **Validation**: Component tests for empty, one-source, multiple-source, and missing-source states; run accessibility assertions where existing test setup supports them.

### Task 3.3: Add a reusable selected-image Modify-node creation action
- **Location**: `src/components/workbench/hooks/useWorkbenchBlockCreation.ts`, `src/components/workbench/hooks/workbenchBlockCreationLogic.ts`, new logic tests, and Workbench store action wiring
- **Description**: Extract an atomic action that filters the current selection to image/media nodes as defined by the product model, creates one Modify node at a deterministic position, and adds connections from every selected image to the new node. Reuse the same creation path from the plus-menu Modify item instead of keeping the menu as a no-op.
- **Dependencies**: Tasks 3.1 and 3.2.
- **Acceptance Criteria**:
  - `Q` with selected images creates exactly one Modify node.
  - All eligible selected images connect to that node exactly once.
  - Non-image selected nodes are ignored or rejected according to the connection policy without preventing eligible images from connecting.
  - No-op selection does not create an orphan Modify node.
  - Creation, node selection, menu close, and persistence are atomic/consistent with existing one-shot block creation behavior.
- **Validation**: Unit-test zero, one, multiple, mixed, duplicate, and stale-selection cases; test the store's resulting nodes and connections.

### Task 3.4: Add `Q` to the keyboard action path
- **Location**: `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts`, `src/components/workbench/hooks/useWorkbench.ts`, corresponding tests
- **Description**: Inject the selected-image Modify-node action into the shortcut hook and map `q`/`Q` to it as a non-tool action. Keep the existing input/contenteditable guard and modifier handling.
- **Dependencies**: Task 3.3.
- **Acceptance Criteria**:
  - `Q` creates a Modify node from all currently selected images.
  - `Q` does nothing with no eligible selected images.
  - `Q` does not switch tools or run while editing text/forms.
  - The shortcut is case-insensitive and does not conflict with `Ctrl/Cmd` shortcuts.
- **Validation**: Extend keyboard-hook tests and add an integration test proving the action receives the full current selection.

### Task 3.5: Preserve double-click Studio entry and disable empty-canvas double-click zoom
- **Location**: `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`, `src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts`, `src/components/workbench/workbench.tsx`
- **Description**: Keep the current image/media double-click `openNodeInStudio` behavior, explicitly disable React Flow canvas double-click zoom, and test that unsupported nodes and empty canvas do not enter Studio.
- **Dependencies**: Task 3.1.
- **Acceptance Criteria**:
  - Double-click on an editable image/media opens Studio.
  - Double-click on empty canvas does nothing.
  - Double-click on unsupported nodes does not open Studio unexpectedly.
- **Validation**: Run node-handler tests and verify node versus pane double-click behavior in a browser.

## Sprint 4: Input Normalization, Accessibility, and Regression Convergence

**Goal**: Review all Workbench input paths together, document the final model, and verify that the change is safe across desktop workflows.

**Demo/Validation**:
- A complete Workbench workflow can create, select, multi-select, move, pan, zoom, edit, reorder, delete, undo, redo, and open Studio without hand mode.
- Keyboard and mouse controls do not interfere with inputs or node editors.
- Build, lint, unit tests, and accessibility checks pass.

### Task 4.1: Review wheel, trackpad gestures, right-click, spacebar, touch, and overlays
- **Location**: `src/components/workbench/workbench.tsx`, `src/components/workbench/WorkbenchChrome.tsx`, node components with interactive inputs
- **Description**: Audit React Flow's wheel/pinch behavior and browser trackpad event semantics. Ensure two-finger translation maps to pan while pinch direction maps to zoom. Also review context menus, Space handling, touch fallback, overlay `pointer-events`, and `nopan`/`nodrag` classes.
- **Dependencies**: Sprints 1–3.
- **Acceptance Criteria**:
  - Right-click context menus still open at the intended target.
  - Two-finger trackpad movement pans rather than zooms.
  - Pinch-out zooms in and pinch-in zooms out.
  - Wheel/trackpad handling does not accidentally select, move nodes, or submit node-editor inputs.
  - Textareas, dropdowns, sliders, and buttons remain keyboard-operable.
  - Touch behavior is either preserved intentionally or explicitly documented as unsupported.
- **Validation**: Manual matrix across middle mouse, trackpad pan, pinch in/out, wheel, keyboard focus, touch, and overlays; run accessibility-focused interaction checks.

### Task 4.2: Add/update end-to-end interaction coverage
- **Location**: Existing Workbench test locations or a new browser test location selected by repository conventions
- **Description**: Add browser-level coverage for middle-button panning, background deselection, Shift multi-selection, arrow-key panning, `Q`, double-click Studio entry, and `[`/`]` ordering.
- **Dependencies**: Task 4.1.
- **Acceptance Criteria**:
  - The highest-risk pointer and keyboard flows are covered outside isolated hook tests.
  - Tests assert visible state/viewport outcomes, not implementation details only.
- **Validation**: Run the project’s browser test command if configured; otherwise document the manual checklist and keep deterministic unit coverage for extracted helpers.

### Task 4.3: Update Workbench shortcut documentation and in-product help
- **Location**: Workbench shortcut UI/documentation discovered during implementation
- **Description**: Replace stale hand-mode guidance with the final interaction table, including middle mouse, Shift multi-select, arrow panning, `Q`, `T`, `[` and `]`.
- **Dependencies**: Task 4.2.
- **Acceptance Criteria**:
  - No stale Hand/H shortcut guidance remains.
  - Labels use platform-neutral wording where appropriate (`Ctrl/Cmd`).
  - The help text explains that empty background click clears selection.
- **Validation**: Repository-wide search for `hand`, `Hand`, and old shortcut labels, followed by a UI review.

## Testing Strategy

- **Pure logic**: Test shortcut classification, editable-image resolution, arrow direction/step calculation, and React Flow mode props without rendering the full Workbench.
- **Hook tests**: Extend `useWorkbenchKeyboardShortcuts.test.ts` for arrow keys, `Q`, input suppression, modifiers, and regressions. Extend node-handler tests for selection and double-click behavior.
- **Component/integration tests**: Verify that React Flow receives middle-button pan configuration and Shift multi-selection configuration where practical.
- **Browser/manual tests**: Validate actual mouse-button behavior because React Flow pointer handling and browser button semantics are difficult to prove entirely in jsdom. Also verify the Modify node's connected preview and multi-image creation flow in a real Workbench.
- **Required commands before convergence**:
  - `pnpm test` (or focused Vitest files during iteration)
  - `pnpm run lint`
  - `pnpm run build`

## Potential Risks & Gotchas

- React Flow's `panOnDrag` accepts mouse-button arrays; the implementation must use the library's button numbering correctly (`1` is the middle button) and ensure touch panning is not unintentionally disabled.
- Current code uses `selectionKeyCode="Shift"` and `multiSelectionKeyCode={['Meta', 'Control']}`. These are separate React Flow concepts; changing only one may produce unexpected rectangle-selection or click-selection behavior.
- `handleNodesChange` manually accumulates selected IDs. React Flow may emit multiple `select` changes in one event, so stale closure logic can lose or re-add IDs unless the update is derived from the complete change set or uses the intended current node selection.
- Arrow-key viewport movement should not write node gesture history or trigger scene persistence on every key repeat.
- `Q` must not run while a TextNode, NoteNode, prompt field, dropdown, or other editable control has focus. The existing input/contenteditable guard should be reused and tested.
- Existing double-click handling opens only image/media nodes, while React Flow may also use canvas double-click for zoom. The requested behavior is to disable canvas double-click zoom and reserve double-click entry for editable items.
- The current plus-menu exposes Modify but `useWorkbenchBlockCreation` treats it as a no-op. The shortcut work therefore requires completing the underlying node type, view, creation logic, and connection policy rather than only adding a key binding.
- Multiple selected images require a deterministic Modify preview policy and connection ordering; the node must tolerate missing/deleted source nodes.
- Removing `hand` from the union can expose stale persisted state or exhaustive branches. Add a safe migration/fallback to `select` if persisted Workbench state can contain the old value.
- Several existing files already contain comments referring to hand mode and WIP behavior; tests and documentation must be updated together to avoid a misleading contract.
- The project instructions prohibit `any`, inline styles, and effect/fetch logic outside hooks. New event logic should respect those constraints.

## Rollback Plan

1. Revert the Workbench input/shortcut commits in reverse sprint order.
2. Restore the `hand` tool type/configuration and previous React Flow mode props.
3. Restore the previous `multiSelectionKeyCode` configuration if Shift selection proves incompatible with the current node-change handler.
4. Keep the new tests where they describe still-valid behavior; otherwise revert them with the corresponding implementation changes.
