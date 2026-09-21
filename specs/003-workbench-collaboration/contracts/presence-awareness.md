# Contract: Presence & Cursor Awareness

## Payload Shape

Each connected client publishes one awareness state for the room:

```json
{
  "user": { "id": "<uuid>", "name": "<display name>" },
  "cursor": { "x": 412.5, "y": -88.0 }
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `user.id` | UUID | yes | Collaborator identity; equals the room token's `userId`. Used to key the presence list and to exclude one's own cursor from the overlay. |
| `user.name` | string | yes | Display name shown in the presence indicator (from the authenticated user profile). |
| `cursor` | `{ x: number, y: number }` or null | no | Pointer position in **canvas (world) coordinates**, not screen pixels — so cursors stay correct under pan/zoom. `null` when the pointer is idle or outside the canvas. |

## Update Rules

- Cursor updates are throttled to at most one per animation frame (~16 ms) while the pointer moves; no periodic emission when idle (research Decision 7).
- Source of truth for local cursor position: the workbench's existing pointer-tracking hook; no new tracking mechanism is introduced.
- `user` fields are published once on join and updated only if identity data changes (it does not, in v1).

## Derivation & Lifecycle

- **Presence list** = current awareness states of the room, excluding the local client for "others" views. Rendered by `PresenceIndicator`.
- **Cursor overlay** = remote cursor entries with non-null `cursor`, rendered by `CursorOverlay` (one indicator per remote collaborator, labeled with display name).
- A presence entry and its cursor disappear automatically when the peer disconnects or tears down its provider (awareness removal) — spec FR-005. No manual "leave" action is required; closing the workbench or switching projects tears down the session.
- Visibility timing: a newly joined collaborator's presence must be visible to existing members within 2 seconds (SC-003).

## Boundaries

- Awareness is transient and never persisted (not part of the shared document, not written to `scenes`).
- v1 carries identity + cursor only. Selection state, viewport position, and comments are out of scope (spec FR-013) — the payload shape allows future fields without breaking v1 consumers.
- Advisory indicators from the prior near-real-time phase (lock badges) may continue to render as informational signals but must not block editing (spec Assumptions).

## Testing Requirements (per constitution, test-first)

- Published cursor state is visible to a second in-memory client over the fake provider bus; own cursor is excluded from the remote list.
- rAF throttling: simulated high-frequency pointer events produce at most one awareness update per frame.
- Peer teardown removes its presence entry from the other client's derived list.
- Canvas-coordinate mapping: a cursor published under pan/zoom renders at the same world position in another session's viewport.
