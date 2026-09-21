# Plan: GitHub Spec Kit + TDD Adoption

**Generated**: 2026-07-10
**Estimated Complexity**: Medium (tooling) / High (pilot feature itself)

## Overview

Adopt **GitHub Spec Kit** (SDD workflow: constitution → specify → plan → tasks → implement → converge) using the native **pi integration**, and enforce **layered TDD** with a CI gate.

Current state (verified):
- `specify` CLI already installed (`~/.local/bin/specify`, Python 3.13, uv present)
- Spec Kit supports pi natively: `--integration pi` installs slash commands as prompt templates into **`.pi/prompts/*.md`**
- Repo is an **existing project** → follow spec-kit's existing-project guide (init in place, constitution from real rules, one bounded pilot feature)
- Tests: Vitest 4 + RTL + jsdom, **13 files / 48 tests, all passing (~1s)**, no config file, per-file `// @vitest-environment jsdom` docblocks, **no coverage tooling**
- No CI (`.github/workflows/` does not exist)

### Assumptions (user declined clarification — defaults chosen)
| Decision | Default | Rationale |
|---|---|---|
| Spec Kit scope | **SDD core + idea assessment + git extension** (user-confirmed) | Assess is the front door for new ideas (go → hands off to `/speckit.specify`); git manages feature branches/numbering |
| TDD strictness | **Layered TDD** — test-first for services/hooks/stores/utils; component tests written from spec acceptance criteria before implementation (behavior-verification allowed) | Konva canvas work is impractical under pure red-green |
| CI gate | GitHub Actions: lint + tsc + vitest with coverage floor at current baseline | Enforces discipline without blocking adoption |
| Pilot feature | `plans/workbench-toolbar-tools-plan.md` | Already scoped, bounded, reviewable |

## Prerequisites
- `specify` CLI (✅ installed)
- Node 22 + **pnpm 10** (verified: `node_modules` is pnpm layout, lockfileVersion 9.0; npm install fails on this tree. `package-lock.json` is stale — recommend deleting it)
- GitHub repo with Actions enabled (for Sprint 2 Task 2.5)

---

## Sprint 1: Spec Kit Foundation
**Goal**: Working SDD toolkit in pi + project constitution grounded in real rules.
**Demo/Validation**:
- `/speckit.constitution`, `/speckit.specify`, etc. appear as slash commands in pi
- `.specify/memory/constitution.md` committed with v1.0.0 principles
- `git diff` of init reviewed and clean

### Task 1.1: Reviewable baseline
- **Location**: repo root
- **Description**: Commit or stash all current work (git status shows modified `AGENTS.md`, `next.config.mjs`, `package-lock.json`, etc.). Create branch `chore/spec-kit-adoption`.
- **Dependencies**: none
- **Acceptance Criteria**: clean tree, dedicated branch
- **Validation**: `git status --short` empty; `git branch --show-current`

### Task 1.2: Initialize Spec Kit for pi + extensions
- **Location**: repo root
- **Description**: From the repo root, in order:
  1. `specify init --here --force --integration pi`
  2. `specify extension add assess` (idea assessment; requires speckit ≥0.9.0 — installed is 1.0.8 ✅)
  3. `specify extension add git` (branching workflow; requires ≥0.2.0 ✅)

  Review the full diff. Expected artifacts: `.specify/` (templates, scripts, memory, `extensions/{assess,git}/`) and `.pi/prompts/speckit.*.md`, now including:
  - SDD core: `constitution, specify, clarify, plan, tasks, analyze, checklist, implement, converge`
  - Assess: `speckit.assess.intake / research / define / shape / decide` → reports in `.specify/assessments/<slug>/`
  - Git: `speckit.git.feature / validate / remote / initialize / commit`

  Housekeeping:
  - **Remove** `.pi/prompts/speckit.taskstoissues.md` — it requires GitHub MCP, which pi lacks out of the box.
  - Verify `.specify/` is **not** gitignored (commit templates + memory; they are reviewable project artifacts).
- **Dependencies**: Task 1.1
- **Acceptance Criteria**: init + both extension diffs reviewed; taskstoissues removed; all other files committed
- **Validation**: `ls .pi/prompts/ .specify/extensions/`; pi session lists all speckit commands incl. `speckit.assess.*` and `speckit.git.*`

### Task 1.3: Write the constitution
- **Location**: `.specify/memory/constitution.md` (via `/speckit.constitution`)
- **Description**: Invoke in pi: `/speckit.constitution` with principles that are **already true** in this repo (evidence: AGENTS.md, CI-less test suite, folder mapping). Seed principles:
  1. Type safety: no `any`, no `@ts-ignore`; `tsc` must pass
  2. Styling: Tailwind only, no inline styles
  3. Logic in `use[Feature].ts` hooks; server state via react-query; global state via zustand
  4. File limit 300 lines → split Logic/View/Types
  5. Named exports; absolute `@/features/...` imports preferred
  6. **TDD**: new logic (services/hooks/stores/utils) must be test-first (red→green); components get behavior tests derived from spec acceptance criteria before implementation
  7. No merge without green `lint + tsc + vitest`; coverage floor may not regress
- **Dependencies**: Task 1.2
- **Acceptance Criteria**: constitution committed, versioned 1.0.0, every principle traceable to an existing rule or explicit team decision
- **Validation**: read-back in pi; `/speckit.plan` on a later feature cites it

### Task 1.4: Configure the git extension
- **Location**: `.specify/extensions/git/git-config.yml`
- **Description**: Set branch numbering strategy (sequential `001-…` recommended for a solo/small team), optional branch template, and decide whether `speckit.git.commit` auto-commits after each speckit command (recommend: on, with conventional-commit style messages — review the generated config defaults first).
- **Dependencies**: Task 1.2
- **Acceptance Criteria**: config committed; `/speckit.git.feature` dry-run produces an expected branch name
- **Validation**: `specify extension info git`; read back config

### Task 1.5: Point AGENTS.md at the workflow
- **Location**: `AGENTS.md`
- **Description**: Add a short "Spec-Driven Development" section: when to run which `/speckit.*` command, where specs live (`specs/NNN-feature/`) and assessments (`.specify/assessments/<slug>/`), the assess→specify handoff for new ideas, feature branches via `/speckit.git.feature`, and the TDD layering rule. Keep it ≤20 lines; link, don't duplicate.
- **Dependencies**: Task 1.3, Task 1.4
- **Acceptance Criteria**: any agent reading AGENTS.md knows the SDD entry points
- **Validation**: manual review

---

## Sprint 2: TDD Harness + CI Gate
**Goal**: Deterministic, gated test pipeline with a coverage floor that cannot regress.
**Demo/Validation**:
- `npm run test:ci` runs headless with coverage report locally
- Push branch → GitHub Actions green; deliberately breaking a test → red

### Task 2.1: Dedicated vitest config
- **Location**: `vitest.config.ts` (new)
- **Description**: Extract from implicit defaults: `environment: 'jsdom'` as default, `setupFiles: ['./src/test/setup.ts']`, include `src/**/*.test.{ts,tsx}`, coverage provider `v8` with exclude for `*.d.ts`, `types/`, generated drizzle files. Remove per-file `// @vitest-environment jsdom` docblocks (3 files) once global env is set.
- **Dependencies**: none (parallel-safe with Sprint 1)
- **Acceptance Criteria**: all 48 existing tests still pass with identical behavior; config committed
- **Validation**: `npx vitest run` → 13 passed

### Task 2.2: Test setup file
- **Location**: `src/test/setup.ts` (new)
- **Description**: Import `@testing-library/jest-dom/vitest`; add any shared mocks (e.g., matchMedia, ResizeObserver — check what component tests currently mock inline and hoist the common ones).
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: setup imported once globally; no test behavior change
- **Validation**: `npx vitest run` → 13 passed

### Task 2.3: Coverage baseline
- **Location**: `package.json`, `vitest.config.ts`
- **Description**: `npm i -D @vitest/coverage-v8`. Run `npx vitest run --coverage`. Record the numbers (lines/functions/branches) in this plan file under "Coverage Baseline".
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: baseline recorded
- **Validation**: coverage table printed

### Task 2.4: CI test script + non-regressing floor
- **Location**: `package.json`, `vitest.config.ts`
- **Description**: Add `"test:ci": "vitest run --coverage"`. Set initial thresholds in vitest config at **baseline − 1 point** (per metric) so the gate passes today but any regression fails. Ratchet up after each feature lands (Sprint 4).
- **Dependencies**: Task 2.3
- **Acceptance Criteria**: `npm run test:ci` green; deleting a tested function makes it red on coverage
- **Validation**: both checks

### Task 2.5: GitHub Actions workflow
- **Location**: `.github/workflows/ci.yml` (new)
- **Description**: On push/PR to main: Node 22, pnpm 10 (`pnpm install --frozen-lockfile`), then `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test:ci`. No DB/services needed (current suite passes without them). Do **not** run `next build` yet (heavy; needs env/DB — see Gotchas).
- **Dependencies**: Task 2.4
- **Acceptance Criteria**: workflow green on main; red when a test is broken
- **Validation**: push branch, watch Actions

---

## Sprint 3: Pilot Feature — Workbench Toolbar Tools (full SDD+TDD loop)
**Status: COMPLETE (2026-09-21)** — branch `001-workbench-toolbar-tools`. Full SDD loop ran end-to-end (specify→clarify→plan→tasks→analyze→implement), 30 tasks done. Tests **48 → 154** (25 files), all green; `lint + tsc + test:ci` pass; coverage ratcheted up on all four metrics. Constitution V: `workbench.tsx` split 636→284 lines; `workbenchSlice.ts` resolved as a documented **accepted exception** (forced split rejected — see `specs/001-workbench-toolbar-tools/plan.md`). Convergence: in-scope except one unrelated secure-context UUID fix that was committed separately.

**Goal**: Prove the loop end-to-end on a real bounded feature, converting `plans/workbench-toolbar-tools-plan.md` into spec-driven, test-first work.
**Demo/Validation**:
- Toolbar renders Select/Hand/Draw/Eraser/Arrow/Text/Note/Media with shortcuts `V/H/D/E/A/T/N/M`
- Sticky vs one-shot tool behavior per existing plan
- CI green; convergence report says **Converged**

### Task 3.0: Feature branch via git extension
- **Location**: git
- **Description**: After Sprints 1–2 are merged to `main`, run `/speckit.git.feature workbench-toolbar-tools` → creates `001-workbench-toolbar-tools` (sequential numbering per Task 1.4 config). All pilot work happens on this branch.
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**: branch created and checked out; `/speckit.git.validate` passes
- **Validation**: `git branch --show-current`

### Task 3.1: Specify
- **Location**: `specs/001-workbench-toolbar-tools/spec.md` (via `/speckit.specify`)
- **Description**: Run in pi: `/speckit.specify Implement the workbench toolbar tools per plans/workbench-toolbar-tools-plan.md — tool order, shortcuts V/H/D/E/A/T/N/M, sticky Draw/Eraser, one-shot Arrow/Text/Note/Media with auto-switch to Select, image-only media picker, non-connectable Arrow/Text/Note nodes in v1. Preserve existing React Flow selection and DrawingOverlay behavior.`
- **Dependencies**: Task 3.0
- **Acceptance Criteria**: spec.md committed; no implementation details leaked into spec
- **Validation**: `/speckit.analyze` later flags zero spec issues

### Task 3.2: Clarify
- **Location**: same feature dir
- **Description**: `/speckit.clarify` — resolve open questions (e.g., upload-from-phone placeholder behavior, Arrow endpoint drag semantics, Text/Note edit-mode focus handling).
- **Dependencies**: Task 3.1
- **Acceptance Criteria**: [NEEDS CLARIFICATION] markers resolved or explicitly deferred
- **Validation**: spec updated

### Task 3.3: Plan
- **Location**: `specs/001-workbench-toolbar-tools/plan.md` (via `/speckit.plan`)
- **Description**: `/speckit.plan` — design must reuse existing architecture per constitution: `activeWorkbenchTool` in the zustand workbench slice, React Flow interaction props driven from mode, custom node types, existing `DrawingOverlay`. Verify plan cites the constitution.
- **Dependencies**: Task 3.2
- **Acceptance Criteria**: plan.md + data model/research artifacts committed; architecture matches AGENTS.md folder mapping
- **Validation**: manual review against `src/store/slices/workbenchSlice.ts`, `src/components/workbench/`

### Task 3.4: Tasks + analyze
- **Location**: `specs/001-workbench-toolbar-tools/tasks.md` (via `/speckit.tasks`)
- **Description**: `/speckit.tasks`, then `/speckit.analyze` for spec↔plan↔tasks consistency. Fix any findings before implementing.
- **Dependencies**: Task 3.3
- **Acceptance Criteria**: tasks are atomic/committable; each logic-layer task lists its test file first
- **Validation**: analyze report clean

### Task 3.5: Implement (layered TDD)
- **Location**: `src/store/slices/workbenchSlice.ts`, `src/components/workbench/...`
- **Description**: `/speckit.implement`. Per-task discipline:
  - **Logic tasks** (tool state machine, shortcut mapping, connection policy): write failing test → implement → green. Test files colocated (`*.test.ts`).
  - **Component tasks** (toolbar UI, Arrow/Text/Note/Media nodes): write behavior tests from spec acceptance criteria first (RTL: render toolbar → press `D` → Draw active; create Text node → auto-switch to Select + selected), then implement.
  - Konva canvas internals: verify via behavior tests + manual dev-server check; do not force unit tests on pixel rendering.
- **Dependencies**: Task 3.4
- **Acceptance Criteria**: every task commit passes `lint + tsc + test:ci` locally
- **Validation**: per-commit green; feature demoable in `npm run dev`

### Task 3.6: Converge + merge
- **Location**: same feature dir
- **Description**: `/speckit.converge`. If it adds tasks → repeat implement→converge until report says **Converged**. Then merge `001-workbench-toolbar-tools` → `main` (PR gated by Sprint 2 CI).
- **Dependencies**: Task 3.5
- **Acceptance Criteria**: convergence report committed; no open gaps; main green
- **Validation**: report verdict; Actions green on main

---

## Sprint 4: Idea Assessment + Ops
**Goal**: Put the assess pipeline to work and tighten the gate after the pilot proves out.

### Task 4.1: First idea assessment (assess pipeline demo)
- **Location**: `.specify/assessments/<slug>/`
- **Description**: Run the full assess loop on one real candidate idea from the backlog — e.g., the "upload from phone" placeholder left in the toolbar plan, or an item from `openviz-mvp-prd.md`:
  `/speckit.assess.intake "…" slug=<slug>` → `research` → `define` → `shape` → `decide`
  Verdict is **go / needs-clarification / kill**. A **go** hands off directly to `/speckit.specify` as the next numbered feature (Task 3 loop repeats on branch `002-…`).
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**: decision report committed with evidence; go/kill outcome recorded
- **Validation**: read `.specify/assessments/<slug>/` decision doc

### Task 4.2: Ratchet coverage floor
- **Description**: After pilot lands, raise vitest thresholds to new measured baseline +2 points. Repeat per feature.
- **Dependencies**: Sprint 3 complete

### Task 4.3: Spec aging policy
- **Description**: Decide where completed feature specs and closed assessments live (keep in `specs/` / `.specify/assessments/` as living docs vs archive). One paragraph in AGENTS.md.
- **Dependencies**: Sprint 3 complete

## Coverage Baseline
_Original baseline captured 2026-09-21 (v8 provider, 13 files / 48 tests). Ratcheted after 001-workbench-toolbar-tools landed (25 files / 154 tests):_
| Metric | Original baseline | After pilot | CI floor (−1pt) |
|---|---|---|---|
| Statements | 42.45% | 47.53% | **46** |
| Branches | 38.53% | 42.88% | **41** |
| Functions | 31.44% | 40.54% | **39** |
| Lines | 43.97% | 49.19% | **48** |

> Note: v8 coverage table column order is Stmts / Branch / Funcs / Lines — don't misread.

---

## Testing Strategy
- **Per task**: logic → unit tests (Vitest) test-first; components → RTL behavior tests from acceptance criteria
- **Per sprint**: `npm run lint && npx tsc --noEmit && npm run test:ci` green before demo
- **Per PR**: GitHub Actions gate (Sprint 2)
- **Canvas/visual**: manual verification in dev server; Playwright/axe available later for e2e + a11y (skills already installed)

## Potential Risks & Gotchas
1. **Repo is mid-migration Vite↔Next 16** — `vite.config.ts`, `src/main.tsx` AND `next.config.mjs`, `src/app/` both exist; dev runs `next dev`. Vitest is bundler-agnostic so tests are safe, but **CI must not run `next build`** yet (slow, may need env/DB). → Mitigation: CI = lint + tsc + test only (Task 2.5).
2. **Dual lockfiles resolved**: `node_modules` proved to be a pnpm tree (npm install crashes with `edgesOut` error) → CI + local use pnpm 10. `package-lock.json` is stale — delete it (pending user confirmation).
3. **`specify init --force` overwrites conflicting managed paths** — only run after Task 1.1 baseline; review diff before committing.
4. **taskstoissues won't work in pi** (no MCP by default) — removed in Task 1.2; don't re-add.
5. **Git extension auto-commits** — `speckit.git.commit` can commit automatically after each speckit command. Decide explicitly in Task 1.4 (recommend on, conventional messages); otherwise surprise commits land mid-review.
6. **Aspirational coverage on day one blocks adoption** — floor set at baseline−1, ratcheted later (Tasks 2.4/4.2).
7. **Konva in jsdom** — canvas rendering is not testable at pixel level; behavior tests + manual checks only. Don't burn time forcing it.
8. **Old `plans/*.md` files coexist with `specs/`** — new work goes through spec-kit; old plans stay as historical context (pilot plan is *input* to the spec, not replaced).
9. **Assess is a gate, not a phase** — intake→decide can end in *kill*; don't treat reaching `/speckit.specify` as automatic. Only go-verdicts hand off to SDD.

## Rollback Plan
- Everything lives on `chore/spec-kit-adoption` → drop the branch to revert all tooling.
- Individual reverts: delete `.specify/`, `.pi/prompts/speckit.*.md`, `vitest.config.ts`, `src/test/setup.ts`, `.github/workflows/ci.yml`; remove coverage thresholds; restore AGENTS.md section. App code is untouched by Sprints 1–2.
- Pilot feature (Sprint 3) rolls back via normal git revert of its commits — spec artifacts can stay for reference.
