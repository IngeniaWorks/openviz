# Plan: One-Command Project Initialization (`npm run setup` / `npm run init`)

## Summary
Implement a first-run initializer that makes OpenViz bootable out of the box in local mock mode.  
`npm run setup` will:
1. auto-install dependencies,
2. create/merge `.env` from `.env.example` with guided defaults,
3. validate required env values for local mock mode,
4. validate DB connectivity and run schema setup,
5. optionally run bootstrap seed (initial user/workspace/example project),
6. start the dev server.

`npm run init` will be an alias to the same command.

## Public Interfaces / Contract Changes
1. `package.json` scripts:
- add `setup` (interactive initializer)
- add `init` alias to `setup`
- optionally add `setup:check` (non-interactive validation mode)

2. New CLI entrypoint:
- `/Users/FuturiaWorks/Development/openviz/scripts/setup.ts` (or split module files under `scripts/setup/`)

3. Optional server bootstrap endpoint/service integration:
- reuse or add idempotent bootstrap function so setup can seed initial records without relying on first API request.

4. Documentation updates:
- README onboarding switches from manual multi-step to single command.

## Prerequisites
- Node.js available
- Local PostgreSQL running and reachable by `DATABASE_URL`
- No hard requirement for Redis/S3/ComfyUI in default local mock profile

## Dependency Graph
```text
T1 ──┬── T3 ──┬── T5 ──┐
     │        │         ├── T8 ── T9
T2 ──┘        └── T6 ──┤
T4 ────────────────┬────┘
                    └── T7
```

## Tasks

### T1: Define Setup UX + Config Contract
- **depends_on**: []
- **location**: `/Users/FuturiaWorks/Development/openviz/scripts/setup.ts`, `/Users/FuturiaWorks/Development/openviz/package.json`
- **description**: Define exact setup flow, prompts, required/optional env keys, and exit behavior (fail-fast with actionable errors).
- **validation**: Written flow covers install, env, db push, bootstrap, dev start paths.
- **status**: Completed
- **log**: Defined one-command setup flow in `scripts/setup.ts` with explicit required local keys, placeholder detection, fail-fast command runner, DB validation, seed bootstrap, and automatic dev-server start behavior.
- **files edited/created**: `scripts/setup.ts`

### T2: Normalize Environment Source of Truth
- **depends_on**: []
- **location**: `/Users/FuturiaWorks/Development/openviz/.env.example`, `/Users/FuturiaWorks/Development/openviz/README.md`
- **description**: Reconcile mismatches (README currently references `AWS_*` while code uses `S3_*`), define local mock minimum required vars.
- **validation**: `.env.example` + README are consistent with runtime code.
- **status**: Completed
- **log**: Normalized `.env.example` for direct `DATABASE_URL`, clarified optional vs required variables, and aligned README variable names with runtime (`S3_*` instead of `AWS_*`) while documenting mock-mode defaults.
- **files edited/created**: `.env.example`, `README.md`

### T3: Implement Dependency Install Step
- **depends_on**: [T1]
- **location**: `/Users/FuturiaWorks/Development/openviz/scripts/setup.ts`
- **description**: Detect `node_modules`; if missing, run `npm install` automatically and surface errors clearly.
- **validation**: Fresh clone with no dependencies proceeds via setup.
- **status**: Completed
- **log**: Added `node_modules` detection and automatic `npm install` execution before any setup step that depends on installed packages.
- **files edited/created**: `scripts/setup.ts`

### T4: Add Idempotent App Bootstrap Service (DB Records)
- **depends_on**: []
- **location**: `/Users/FuturiaWorks/Development/openviz/src/lib/services/bootstrap.ts`, `/Users/FuturiaWorks/Development/openviz/src/lib/services/bootstrapTemplates.ts`
- **description**: Implement idempotent creation/repair of user + default workspace + owner membership + example project with prefilled demo graph scene.
- **validation**: Repeated calls produce no duplicates; partial accounts auto-heal.
- **status**: Completed
- **log**: Added transactional bootstrap service plus typed example scene template; service ensures user row, default workspace membership, and one seeded example project with main scene while remaining idempotent across reruns.
- **files edited/created**: `src/lib/services/bootstrap.ts`, `src/lib/services/bootstrapTemplates.ts`

### T5: Implement Guided `.env` Initialization
- **depends_on**: [T1, T2, T3]
- **location**: `/Users/FuturiaWorks/Development/openviz/scripts/setup.ts`
- **description**: If `.env` missing, generate from `.env.example`; prompt for required local values (`DATABASE_URL`, `NEXTAUTH_SECRET`, dev-admin creds), preserve existing values on reruns.
- **validation**: First run creates usable `.env`; rerun is non-destructive.
- **status**: Completed
- **log**: Implemented `.env` bootstrap (copy from `.env.example` when missing), interactive required-value collection, generated `NEXTAUTH_SECRET`, and safe merge behavior with preservation of unrelated lines.
- **files edited/created**: `scripts/setup.ts`, `scripts/setupUtils.ts`

### T6: Implement DB Validation + Schema Setup
- **depends_on**: [T3, T5]
- **location**: `/Users/FuturiaWorks/Development/openviz/scripts/setup.ts`, `/Users/FuturiaWorks/Development/openviz/drizzle.config.ts`
- **description**: Verify DB connectivity from `DATABASE_URL`; run `npm run db:push`; report clear failure guidance.
- **validation**: Empty DB receives schema successfully via setup.
- **status**: Completed
- **log**: Added explicit DB connectivity test (`select 1`) before running schema creation via `npm run db:push`; setup aborts with actionable errors on failure.
- **files edited/created**: `scripts/setup.ts`

### T7: Wire Bootstrap Execution from Setup
- **depends_on**: [T4, T6]
- **location**: `/Users/FuturiaWorks/Development/openviz/scripts/setup.ts`, optionally `/Users/FuturiaWorks/Development/openviz/src/app/api/workspaces/route.ts`
- **description**: After schema setup, run bootstrap seed path to ensure initial records exist before first UI visit.
- **validation**: First app load shows default workspace + example project immediately.
- **status**: Completed
- **log**: Wired bootstrap execution in setup (seeding from dev-admin credentials) and in runtime `GET /api/workspaces` + `GET/POST /api/projects` to auto-heal partial accounts and guarantee first-run data.
- **files edited/created**: `scripts/setup.ts`, `src/app/api/workspaces/route.ts`, `src/app/api/projects/route.ts`

### T8: Add Script Entrypoints + Start Behavior
- **depends_on**: [T5, T6, T7]
- **location**: `/Users/FuturiaWorks/Development/openviz/package.json`
- **description**: Add `setup` and `init` scripts; final step launches `npm run dev` on success.
- **validation**: `npm run init` and `npm run setup` both produce same successful outcome.
- **status**: Completed
- **log**: Added `setup` and `init` scripts in `package.json`; setup now starts `npm run dev` automatically after successful initialization.
- **files edited/created**: `package.json`, `scripts/setup.ts`

### T9: Tests + Docs + Failure Matrix
- **depends_on**: [T8]
- **location**: `/Users/FuturiaWorks/Development/openviz/README.md`, test files under `scripts`/`src/lib/services` as applicable
- **description**: Add tests for bootstrap idempotency and env merge logic; document one-command onboarding and troubleshooting.
- **validation**: `npm test` passes; README setup section is accurate.
- **status**: Completed
- **log**: Added targeted tests for setup env merge/placeholder logic and seeded scene shape. Updated README with one-command setup and manual fallback steps.
- **files edited/created**: `scripts/setupUtils.test.ts`, `src/lib/services/bootstrapTemplates.test.ts`, `README.md`

## Parallel Execution Groups

| Wave | Tasks | Can Start When |
|------|-------|----------------|
| 1 | T1, T2, T4 | Immediately |
| 2 | T3 | T1 complete |
| 3 | T5, T6 | T3 complete (T5 also needs T2) |
| 4 | T7 | T4 and T6 complete |
| 5 | T8 | T5, T6, T7 complete |
| 6 | T9 | T8 complete |

## Testing Strategy
1. Fresh machine simulation:
- remove `.env`, remove `node_modules`, run `npm run setup`.
- expect install + env creation + db push + bootstrap + dev server start.

2. Rerun idempotency:
- run setup twice; verify no destructive env overwrite and no duplicate default records.

3. Partial failure scenarios:
- bad `DATABASE_URL` -> actionable error.
- DB reachable but permission denied -> actionable error.
- missing required env after prompt cancellation -> fail with instructions.

4. Bootstrap data verification:
- DB has exactly one default workspace membership per user.
- example project exists with one main scene containing demo graph payload.

## Risks & Mitigations
- Risk: interactive setup blocks CI.
- Mitigation: add `setup:check` non-interactive mode and keep prompts only for `setup`.

- Risk: env rewrite accidentally removes comments/order.
- Mitigation: merge by key with preservation strategy and backup `.env.bak`.

- Risk: bootstrap coupled to request-time auth.
- Mitigation: expose service-level function callable from setup script directly.

## Assumptions / Defaults Chosen
1. `setup` auto-installs dependencies.
2. DB mode is “validate URL + push schema”; no automatic DB server/user provisioning.
3. Default runtime profile is local mock mode (Redis/S3/ComfyUI not required to start).
4. `init` is an alias to `setup`.
5. Setup ends by starting `npm run dev` on success.
