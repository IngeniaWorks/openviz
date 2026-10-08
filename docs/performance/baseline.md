# Performance Baseline (Sprint 0)

**Captured**: 2026-10-08 · production build (`pnpm run build` + `next start`, Next.js 16.2.4, webpack)
**Environment**: local host, docker-compose Postgres/Redis/MinIO (`localhost:5434/6379/4566`), dev-admin session (all-zero user id)
**Tooling**: `pnpm run perf` → `scripts/perf-lighthouse.mjs` (Lighthouse desktop preset + CDP flow capture, authenticated via minted Auth.js JWT)

## Flow 1 — Dashboard load (`/files/<ws>/recents`)

| Metric | Value | Note |
|---|---|---|
| Lighthouse score | **58** | desktop, authenticated |
| FCP | 2715ms | |
| LCP | **14340ms** | dominated by project-card thumbnails (data-URL images from scene JSONB) |
| TBT | 126ms | |
| CLS | 0.000 | |
| Total transferred | **32.2MB** | per-card `/api/projects/[id]/previews` N+1 + base64 thumbnails (mock mode) |
| Main-thread work | 1.1s | Script Evaluation 445ms, Other 485ms |

## Flow 2 — Dashboard → open project (CDP capture, warm dashboard)

### Small project ("Untitled", scene JSONB ≈ 133KB)

| Metric | Value |
|---|---|
| Open → canvas interactive | **457ms** |
| Post-nav requests | 30 (17 JS chunks + RSC payload fetches + API calls) |
| View switch workbench→studio | **80ms** |
| View switch studio→workbench | **95ms** |
| Heap after both views mounted | 75MB |

Chunks downloaded *after* the click (what Sprint 1 preloading must eliminate):
`app/projects/[id]/layout-*.js`, `04a6ace5-*.js`, `3619-*.js`, `3824-*.js` (xyflow),
`2928-*.js`, `4808.*.js`, `1584.*.js`, `9099-*.js`, `9105-*.js`, `5116-*.js`,
`7658.*.js`, `980-*.js`, `5908.*.js`, `d0efa934.*.js`, `4558.*.js` (konva, 312K),
`7481-*.js`, `2721.*.js`

### Heavy project ("Test", scene JSONB ≈ **40.9MB** — mock-mode base64 bloat)

| Metric | Value | vs small |
|---|---|---|
| Open → canvas interactive | **3611ms** | 8× slower |
| Post-nav requests | 51 | includes repeated `/api/projects/[id]` fetches |
| View switch workbench→studio | **290ms** | dual-mount no longer "instant" |
| View switch studio→workbench | **587ms** | both canvas engines render heavy scenes |
| Heap after both views mounted | **412MB** | 5.5× |

## Flow 3 — Workbench route load (`/projects/<id>/workbench`)

| Metric | Value | Note |
|---|---|---|
| Lighthouse score | **28** | desktop, authenticated |
| FCP | 2710ms | |
| LCP | 8560ms | canvas content behind JS evaluation |
| TBT | **1253ms** | dual-mount: Konva + ReactFlow + all studio panels evaluate on load |
| Total transferred | 2.2MB | small project |
| Main-thread work | **3.1s** | Script Evaluation **2405ms**, Parsing 229ms, Style&Layout 101ms |
| Bootup time | 2.4s | module evaluation of lazy-loaded view chunks |

## Interpretation → sprint mapping

- **Sprint 1 (preload)**: Flow 2 shows ~700KB of view chunks + route RSC payloads download only after the click; fonts (Inter variable, 728KB) load without preload hints. Goal: zero new chunk downloads on project entry.
- **Sprint 2 (project open)**: heavy-project open is dominated by the 40MB scene JSONB round-trip + store hydration; dashboard LCP is the per-card previews N+1. Goal: cache-first render from IndexedDB, one batched previews request, ETag/304.
- **Sprint 3 (image delivery)**: mock-mode thumbnails are inline base64 (32MB on the dashboard page!); S3 mode pays auth + 307 + fresh presign per image with no HTTP caching. Goal: thumbnail variants, lazy node images, cached presigns, immutable cache headers.
- **Sprint 4 (bundle/runtime)**: workbench TBT 1253ms / bootup 2.4s from evaluating both views' full component trees at once. Goal: defer heavy studio panels out of the initial chunk.

## Results — Sprint 1 (preload & cache headers) · commit `de08af6`

| Metric | Before | After |
|---|---|---|
| JS chunks downloaded after project click | 17 | **1** (only the route's own layout chunk) |
| Dashboard → open → canvas (small project) | 457ms | **280ms** |
| Lighthouse recents score / FCP | 58 / 2715ms | **69 / 1206ms** |
| Lighthouse workbench score / TBT | 28 / 1253ms | **42 / 489ms** |

Changes: shared view-chunk import promises + idle `AppAssetPreloader` (root layout),
dashboard card hover/focus `router.prefetch` + keyboard open, `/projects/[id]/loading.tsx`
skeleton (unlocks route prefetching), font `<link rel="preload">` hoisted to `<head>`,
font cache headers fixed (`max-age=0` → `public, max-age=86400, stale-while-revalidate=604800`).

## Results — Sprint 2 (fast project open) · this commit

Verified in production build via CDP (in-app navigation, warm dashboard):

| Metric | Before | After |
|---|---|---|
| Open → first node, small project (cold) | ~457ms (harness) | **511ms** (CDP dblclick; harness flow re-run pending) |
| Re-open same project (SWR from IndexedDB) | = cold open | **104ms** (5× faster) |
| Open → first node, heavy 40MB project (cold) | 3611ms | **3554ms** (scene fetch now overlaps; render-bound — Sprint 4 target) |
| Re-open heavy project (SWR) | = cold open | **358ms** (10× faster) |
| Dashboard preview requests | N+1 (one per card) | **1** batched `/api/projects/previews` (22 thumbs / 4 projects in one query) |
| `GET /api/projects/:id` revalidation | full body every time | **ETag + 304**; `Cache-Control: private, max-age=5, swr=60` |
| `lastViewedAt` side effect on GET | mutated per read | stable; explicit `POST …/viewed` (fire-and-forget) |
| Heavy scene payload (`?lite=1`) | 39.0MB | **44KB** (880×, inline data URLs stripped) |
| Collab room token | fetched after scene fetch (Workbench mounts only when ready) | **prefetched in parallel** with the scene fetch (`roomTokenPrefetch.ts`) |
| Redundant autosave on open | full-scene re-save + version bump every open | skipped client-side (hydrated-payload guard) and server-side (idempotent PATCH, no version bump) |

Notes:
- SWR first paint uses the persisted `workbenchNodes` when `lastOpenedProjectId === id`
  (new store field — deliberately not cleared on unmount; `currentProjectId` still is).
  Server data reconciles via `shouldHydrateFromServer`; collab-active sessions are never
  clobbered. Full-page loads remain chunk-load-bound (~2.4s locally) — SWR pays off in
  in-app navigation, which is the real user flow.
- Collab *join* (WebSocket) still starts when Workbench mounts; only the token round-trip
  was parallelized. Moving the mount earlier requires a live collab server to validate
  room-seeding semantics — deferred, not done blind.
- Coverage gate: 169 files / 1120 tests green, 72.84% statements (floor held).

## Results — Sprint 3 (image delivery) · this commit

Verified end-to-end against local MinIO (real upload → thumbnail → cached delivery):

| Item | Result |
|---|---|
| Uploaded objects | `Cache-Control: public, max-age=31536000, immutable` **signed into the presigned PUT** and stored as object metadata — browsers fetch each asset's bytes from S3 exactly once and stop re-hitting `/api/assets/<token>` (no more per-image auth + presign minting) |
| Thumbnail pipeline | `POST /api/assets/thumbnail` → sharp WebP ≤512px: 1600×900 PNG (21KB) → **512×288 WebP**, immutable headers, deterministic key (`thumbnails/<…>.webp`) — progressive enhancement: any failure yields `thumbnailUrl: null`, uploads never break |
| Canvas/dashboard display | `project.thumbnail` now carries the small variant for S3 uploads; full resolution stays on `layer.image` (studio editing) — zero rendering changes needed (`ImageNode` already renders `project.thumbnail`) |
| Resolve route | 307 redirect cached `private, max-age=3600` per user (presign target valid 24h; objects immutable) |
| Backfill | `scripts/backfill-thumbnails.mjs` — idempotent, dry-run by default (`--apply` to write); verified: skips existing thumbnails, reports undecodable objects without crashing |

Scope decisions (documented per plan constraints):
- **Redis presign caching skipped**: with immutable object headers + cached redirects, the
  presign-mint cost is paid once per asset per browser. A Redis layer would cache a value
  that is effectively never re-requested — no measurable win, new failure mode. (The plan
  marked this item optional; docker-compose Redis remains available for future use.)
- **Render-path thumbnails out of scope**: ComfyUI render outputs are remote URLs in their
  own cache domain; thumbnail variants cover the S3 upload path (workbench media uploads).
- Mock mode unchanged: data-URL fallback still applies; Sprint 2's `?lite=1` + SWR already
  address mock-mode payload bloat.

## Note: mock-mode payload sizes are not representative

Without S3/MinIO, `assetUpload` falls back to inlining base64 data URLs into
node data (`src/services/assetUpload.ts`). The "Test" project above carries a
**40.9MB scene JSONB** purely from that bloat; production (S3 mode) scenes are
URL references and typically KB-sized. Treat heavy-project numbers here as an
upper bound. `GET /api/projects/:id?lite=1` returns the same scene with inline
data URLs stripped for lighter fetches, and dev-mode logs record each scene's
payload size on project GET (`[perf] scene payload ...`).

## How to re-run

```bash
pnpm run build && pnpm start &        # production server on :3000
pnpm run perf                          # all modes (lh + flow) → docs/performance/runs/<ts>/
node scripts/perf-lighthouse.mjs flow --project <id>   # single project flow capture
```

Raw artifacts per run: `docs/performance/runs/<timestamp>/{summary.md, summary.json, flow.json, lighthouse-*.json}` (gitignored — regenerate with the commands above).
