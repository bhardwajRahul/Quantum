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
