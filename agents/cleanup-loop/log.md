# Cleanup Loop — change log

Append-only audit trail. One entry per atomic step (applied, rejected, deferred,
or sent to manual review), written by the `cleanup-logger` subagent.
Newest entries at the bottom.

Entry format:

```
### <ISO timestamp> — <module> — <APPLIED | REJECTED | DEFERRED | MANUAL_REVIEW>
- Change: <one line, with rung DELETE/SIMPLIFY/REWRITE>
- Commit: <hash or "none">
- Gate: tsc <n>/24, tests <pass/total>, client build <ok/fail/skip>
- Outcome: <completed | in_progress | manual_review>
- Reason (if rejected/deferred): <why>
```

---

## Run summary — 2026-06-15 (/goal, queue drained)

20 modules processed across 20 iterations. Queue fully drained (pending=0, in_progress=0).
- **13 completed**, **9 manual_review** (one module — docker/container.ts — counts in both: banked 2 wins, deferred the rest), **0 rejected** (gate never went red), **1 finding rejected** (DataTable signature trim — params verified in use).
- **15 atomic changes applied**, each its own commit, gate green before every commit, scoped staging (none of the user's ~550 pre-existing working-tree files swept in).
- **tsc baseline ratcheted 24→23** (populateRepository dedup cleared a pre-existing error); ceiling updated in verify-gate.sh + queue so it can't silently regress.
- Final gate: server tsc 23/23, vitest 131/131, client vite build OK.

**Why so many manual_review:** the loop's core rule is "never refactor without a test net." The server has vitest (so server dedups/decompositions proceeded), but the client has NO unit-test runner — `vite build` only catches syntax/import errors, not behavioral regressions. So client god-component decompositions (Alerting/Databases/Domains/Projects/Templates) were limited to mechanically-safe sibling-component extractions (Projects, Templates) and deferred the risky state-untangling. Other deferrals were correctly-identified non-cleanups: intentional feature flags (templateHandler), behavior-changing merges (byte-formatting, codespace env reads), and untested hot-path daemon orchestration (container.reloadContainer). Each manual_review entry records the root cause + what was banked.

---

## Entries

<!-- the loop appends below this line -->

### 2026-06-15T17:21:24Z — server/config/ws.ts — APPLIED
- Change: DELETE — inlined the single-importer ws wiring (`wsController(io)`) into server.ts and removed the pass-through module.
- Commit: 206b91b
- Gate: tsc 24/24, tests 131/131 pass, client build skip (server-only change)
- Outcome: completed
- Reason: pure indirection removal; one importer (server.ts:24), same call + same load timing → behavior-preserving. No new test needed (build/tsc gate is the net for structural deletion).

### 2026-06-15T17:48:17Z — server/utilities/bootstrap.ts — APPLIED
- Change: DELETE — removed dead `deployContainers()` (42 lines) plus the 8 imports it exclusively owned (Repository, Github, RepositoryHandler, sendMail, IUser, IRepository, DockerContainer, DockerContainerService).
- Commit: 1b5824c
- Gate: tsc 24/24, tests 131/131 pass, client build skip (server-only change)
- Outcome: completed
- Reason: superseded by orchestrator/reconcileHandler; grep confirmed zero call sites (only its own def + 3 historical comments). All 8 imports verified used only inside the deleted function. configureApp/ensurePublicFolderExistence/validateEnvironmentVariables untouched. Design-rationale comments referencing the old name left intact (accurate history).

### 2026-06-15T17:50:26Z — server/services/orchestrator/events.ts — APPLIED
- Change: SIMPLIFY — extracted one private `emit(channel, userId, payload)` helper; the 5 emit* exports now delegate to it (122→105 lines).
- Commit: 40d3315
- Gate: tsc 24/24, tests 131/131 pass, client build skip (server-only change)
- Outcome: completed
- Reason: all 5 helpers had an identical userId-guard + try/io.emit/catch body differing only by channel string. Verified all call sites import the named exports (10 sites across 8 handlers + worker) and the *Event interfaces aren't imported elsewhere, so names + typed signatures preserved → behavior-preserving. The `AlertEvent` in alerting/index.ts is a different type (@typings/models/alertRule), unaffected.

### 2026-06-15T17:54:15Z — server/services/tenancy/provisioning.ts — APPLIED (2 commits)
- Change: REWRITE — decomposed two god functions into named single-responsibility helpers.
  - ensureDefaultTenancy (82 lines) → hydrateUser + loadCompleteTenancy + ensurePersonalOrg + ensureOwnerMembership + linkDefaultOrganization (commit 3edacab).
  - runTenancyBackfill (87 lines) → backfillRepositories + table-driven ORG_STAMP_PASSES loop (commit edad593).
- Commit: 3edacab, edad593
- Gate: tsc 24/24, tests 131/131 pass (both commits), client build skip
- Outcome: completed
- Reason: behavior-preserving — fall-through semantics of loadCompleteTenancy match the original (null on any missing piece → repair path); org-stamp pass ORDER preserved (Docker before Metric). File grew +14 LOC (helper signatures/JSDoc) but both god functions are now short linear orchestrators, satisfying the <20-line / one-thing exit criterion. tenancy-scope/crud/org-setup suite is the net.

### 2026-06-15T17:56:51Z — server/services/docker/container.ts — APPLIED (module still in_progress)
- Change: DELETE — removed dead dockerImage/dockerNetwork memoization (2 fields + 2 constructor inits + 2 never-firing cache guards).
- Commit: 7ce18d4
- Gate: tsc 24/24, tests 131/131 pass, client build skip
- Outcome: in_progress (reloadContainer god fn + repeated docker.getContainer still pending)
- Reason: fields were only ever set to null, never assigned the fetched value → guards were no-ops, fetch always ran fresh. Removal is behavior-identical. Imports kept (method return types).

### 2026-06-15T17:58:20Z — server/services/docker/container.ts — APPLIED + MANUAL_REVIEW
- Change: DELETE — dropped dead `return newContainer` in reloadContainer (typed Promise<void>, no caller uses the value).
- Commit: a065fdd
- Gate: tsc 24/24, tests 131/131 pass, client build skip
- Outcome: manual_review (2 safe wins banked: 7ce18d4 dead cache + a065fdd dead return)
- Reason: remaining smell is the 67-line reloadContainer god function + 8× docker.getContainer repetition. Decomposing it is a behavior-preserving REWRITE of hot-path Docker-daemon orchestration with NO behavioral test net — reload.test.ts mocks reloadContainer entirely, testing only the runReload job wrapper. Per the loop's "never refactor without a net" rule, this needs a daemon-mock test written FIRST (a focused task larger than one atomic step). Parked for a human/dedicated pass rather than forced unsafely.

### 2026-06-15T17:59:30Z — server/services/orchestrator/handlers/templateHandler.ts — MANUAL_REVIEW (no change)
- Change: none.
- Commit: none
- Gate: not run (no edit)
- Outcome: manual_review
- Reason: the two flagged smells are both out of scope for an autonomous behavior-preserving cleanup. (1) maybeRouteManagedDatabases is NOT dead code — it is an intentional, fully-wired, documented opt-in feature flag (TEMPLATES_MANAGED_DB, off by default with a container fallback); removing working guarded functionality is a product decision, not a cleanup. (2) runTemplateJob decomposition is a REWRITE with no behavioral test net (no test references templateHandler). Both deferred to a human/dedicated pass.

### 2026-06-15T18:02:45Z — orchestrator/buildHandler.ts + deployHandler.ts — APPLIED
- Change: DELETE/dedupe — extracted byte-identical populateRepository into provision.ts (shared dep) as a named export; both handlers import it; buildHandler's now-unused Repository import dropped.
- Commit: 04204fa
- Gate: tsc 24→23 (one pre-existing error cleared), tests 131/131 pass, client build skip
- Outcome: completed
- Reason: helper was verbatim-duplicated; provision.ts is the natural shared home (already imported by both handlers, deals with repo infra). No circular import (verified). deployHandler keeps Repository (still used at updateOne). BASELINE RATCHET: gate ceiling lowered 24→23 (verify-gate.sh + queue.baseline) so the improvement can't silently regress.

### 2026-06-15T18:05:19Z — server/services/templates/compose.ts — APPLIED
- Change: SIMPLIFY — extracted applyCommonServiceFields (command/environment/ports/volumes) shared by normalizeService and parseLegacy.toService.
- Commit: 18753d4
- Gate: tsc 23/23, tests 131/131 pass, client build skip
- Outcome: completed
- Reason: 4 identical field normalizations were duplicated across the two parsers. splitImageRef deliberately NOT merged (intentionally different compose vs prebuilt). The `?? raw.env` env fallback is a no-op for legacy entries (only carry `environment`) → behavior-preserving. templates.test.ts is the net.

### 2026-06-15T18:07:27Z — server/controllers/database.ts — APPLIED
- Change: SIMPLIFY — extracted reachableScope(req) for the tenant-scope filter duplicated in backupDatabase/restoreDatabase/getConnectionString.
- Commit: 0bcd209
- Gate: tsc 23/23, tests 131/131 pass, client build skip
- Outcome: completed
- Reason: the admin→{}/else project-$in clause was copy-pasted 3×. Scanner's suggestion to use resolveProjectOr403 was a MISREAD — that helper resolves a :projectId param, but these endpoints key off a database :id, so a local filter helper is the correct dedup. Behavior identical (factory-backed create/list/delete untouched).

### 2026-06-15T18:08:30Z — server/services/codespace/provisioner.ts — MANUAL_REVIEW (no change)
- Change: none.
- Commit: none
- Gate: not run (no edit)
- Outcome: manual_review
- Reason: provisionCodespace (~120 lines, 8 sequential act.step daemon calls: pull/network/container/limits/edge/port-bind/readiness/save) is a behavior-preserving REWRITE of hot-path Docker orchestration with NO test net (no test references codespace), and a meaningful test needs heavy daemon mocking — larger than one atomic step. The only mechanical sub-edit (centralizing the 3 process.env reads) has a behavior-change trap: SERVER_IP is read WITH a '127.0.0.1' fallback at L62 but WITHOUT one at L195 — unifying under one constant would change L195's behavior when SERVER_IP is unset (undefined→127.0.0.1). That's a behavior change, not a cleanup. Deferred rather than forcing a risky edit. (L195 missing-fallback looks like a latent bug — noted for the human pass.)

### 2026-06-15T18:10:15Z — client/src/components/organisms/ProtectedRoute/index.js — APPLIED
- Change: DELETE/SIMPLIFY — collapsed 17-line file (copyright header + import/export indirection) to a one-line barrel re-export, matching sibling organism barrels.
- Commit: 5c94d26
- Gate: client vite build OK (server skip — client-only change)
- Outcome: completed
- Reason: AppShell/StatusBar barrels are already `export { default } from './X'`; this one was the outlier. Pure structural; build is the net (no FE unit tests).

### 2026-06-15T18:13:48Z — client/src/hooks/api/user — APPLIED
- Change: SIMPLIFY — extracted useUserResource factory; 4 hooks (DockerContainers/Images/Networks/PortBinding) reduced to thin config wrappers.
- Commit: 268bd19
- Gate: client vite build OK (server skip)
- Outcome: completed
- Reason: 4 hooks shared the paged-fetch + cleanup-on-unmount shape. Behavior preserved VERBATIM incl. (1) intentional dataKey vs cleanupPath mismatch (dockerContainers→'containers' etc.) — factory passes cleanupPath through, does NOT "fix" it; (2) portBinding's undefined initial page — removed the factory's default-param coercion so undefined passes through; (3) portBindingStats via extraKeys. dispatch dep unified to [page] (dispatch is stable). Public names + return shapes unchanged (barrel intact). useUserRepositories left alone (60s polling, different shape).

### 2026-06-15T18:14:50Z — client/src/components/atoms/kit/index.jsx — APPLIED (+ 1 finding rejected)
- Change: DELETE — removed 3 unused back-compat aliases (StatusChip/StatTile/IconButton).
- Commit: 3d61171
- Gate: client vite build OK (server skip)
- Outcome: completed
- Reason: aliases had zero imports across client/src (grep-confirmed). REJECTED the scanner's second finding (DataTable "speculative optional params getRowKey/render/actions"): verified across ~20 call sites that getRowKey (Events) and actions (ApiTokens/Team/container Explorer/OrgEnvVars) are actively used — trimming the signature would BREAK callers. Not speculative; left intact.

### 2026-06-15T18:20:00Z — client/src/pages errText duplication — APPLIED
- Change: SIMPLIFY — extracted errText to @utilities/common/errText.js; removed the 4 identical local defs (Alerting, SetupOrganization, OrganizationSettings, Team) and imported the shared one.
- Commit: 0d8e57c
- Gate: client vite build OK (server skip)
- Outcome: completed
- Reason: all 4 defs were `typeof err === 'string' ? err : (err?.message || fallback)`. Note: during the Team.jsx edit I introduced a stray `const ROLE_TONE = {` line, caught it immediately, and restored the correct structure (roleTone fn intact) before the build — final vite build green confirms full recovery. No behavior change.

### 2026-06-15T18:24:54Z — client/src/pages/protected/platform/Projects/Projects.jsx — APPLIED + MANUAL_REVIEW
- Change: REWRITE(extract) — moved EnvironmentsModal to its own file (Projects.jsx 528→381 LOC); dropped now-unused StatusBadge + Trash2 imports.
- Commit: fcc9f37
- Gate: client vite build OK (server skip)
- Outcome: manual_review (1 safe win banked: fcc9f37)
- Reason: EnvironmentsModal was a module-scope SIBLING (props-only {project,onClose}, zero shared state with Projects) → pure mechanical file move, build-verified. Remaining smells (28 useState across 4 modal flows, duplicated modal-reset pattern, useReducer consolidation) are behavior-changing REWRITEs of interdependent component state with NO FE test net (vite build catches syntax/imports, NOT behavioral regressions). Forcing them risks silent modal breakage; parked for a human/dedicated pass.

### 2026-06-15T18:31:03Z — client/src/pages/protected/platform/Templates/Templates.jsx — APPLIED + MANUAL_REVIEW
- Change: REWRITE(extract) — moved InstallModal to its own file + relocated shared truncate helper to @utilities/common/truncate (Templates.jsx 429→279 LOC); dropped unused Input import.
- Commit: e3a009c
- Gate: client vite build OK (server skip)
- Outcome: manual_review (1 safe win banked: e3a009c)
- Reason: InstallModal was a module-scope sibling (props-only) → mechanical move; truncate was shared by parent+modal so promoted to a util (avoids dup + bad import direction). Remaining: CatalogBrowser extraction + 14 useState consolidation — behavior-changing REWRITE, no FE test net. Deferred.

### 2026-06-15T18:31:03Z — Alerting.jsx / Databases.jsx / Domains.jsx — MANUAL_REVIEW (no change)
- Change: none.
- Commit: none
- Gate: not run (no edit)
- Outcome: manual_review (batch)
- Reason: unlike Projects/Templates, these three define their modals INLINE within the main component (no module-scope sibling subcomponent — verified via grep for top-level `const [A-Z]...= (`). Extracting an inline modal means untangling it from the parent's 16-22 useState, i.e. a behavior-changing REWRITE, with NO FE test net (vite build won't catch behavioral regressions). No safe atomic win available; the whole god-component decomposition is deferred to a human/dedicated pass (ideally after adding Playwright/RTL coverage for these flows).

### 2026-06-15T18:33:00Z — client/src/utilities byte-formatting — MANUAL_REVIEW (no change)
- Change: none.
- Commit: none
- Gate: not run (no edit)
- Outcome: manual_review
- Reason: both candidate edits are behavior-CHANGING, not cleanups. (1) Migrating humanFileSize's single caller (CreateDockerContainer:89) to the shared formatBytes changes rendered output: humanFileSize uses lowercase 'kB' + 2-decimal-stripped (1500→"1.46 kB"), formatBytes uses 'KB' + 1-decimal-fixed (1500→"1.5 KB"). (2) Databases.jsx:43 has a THIRD local formatBytes whose null/NaN fallback is '—' vs the shared util's '0 B' — merging changes the empty-state display. The audit memory explicitly warns "formatBytes variants — intentionally different fallbacks, don't blind-merge". Both need a design decision on canonical formatting; deferred rather than silently changing UI output.

---

## Run 2 — 2026-06-15 (fresh deletion-focused scan over run-1 output)

Re-scan after run 1, biased hard toward DELETE. 2 high-confidence findings, both applied, gate green throughout. Final: server tsc 23/23, vitest 131/131, client build OK.

### 2026-06-15T18:50:45Z — server/services/orchestrator/index.ts — APPLIED
- Change: DELETE — removed enqueueBuild, stopOrchestrator, and the `export default {...}` barrel (260→229 LOC).
- Commit: 851f130
- Gate: tsc 23/23, tests 131/131 pass, client build skip
- Outcome: completed
- Reason: all three grep-confirmed unreferenced. enqueueBuild was the only producer of standalone type:'build' jobs (none are enqueued; deployHandler calls runBuild directly). stopOrchestrator has zero callers — the SIGINT handler uses process.exit(0). The default barrel is never default-imported (all 11+ sites use named imports; templateHandler's dynamic import reads the named .enqueueDatabaseJob). dispatch 'build' case + buildHandler left intact (runBuild still used by deployHandler).

### 2026-06-15T18:51:47Z — server/controllers/common/dockerFS.ts — APPLIED
- Change: SIMPLIFY/fix — replaced `console.log(error)` with `logger.error(...)` (codebase file-prefix convention) in updateContainerFile's catch; added the logger import.
- Commit: 452c342
- Gate: tsc 23/23, tests 131/131 pass, client build skip
- Outcome: completed
- Reason: debug leftover that swallowed a writeFile failure to stdout. NOT deleted — the catch has no other handling, so removing it would silently swallow the error; converting to logger.error records it without changing response behavior.
