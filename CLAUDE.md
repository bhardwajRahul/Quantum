# CLAUDE.md — Quantum

## Build / test baseline (the gate)

- **Server** (`server/`) runs on **tsx** (types stripped at runtime — there is no
  typecheck gate at runtime). `tsc --noEmit` currently reports **24 pre-existing
  errors**; treat 24 as a ceiling — a change must introduce **no new** tsc errors.
  Run: `cd server && node_modules/.bin/tsc --noEmit | grep -c "error TS"`.
- **Server tests:** `cd server && node_modules/.bin/vitest run` — **131 passing**
  baseline. Must stay green.
- **Client** (`client/`): `cd client && npm run build` (vite) must succeed. No
  unit-test runner — the build is the net.
- One-shot gate for all three: `bash agents/cleanup-loop/scripts/verify-gate.sh`.
- Install quirk: `server/node_modules` may be root-owned (Docker leftover). If
  reinstalling: `rmdir node_modules` then `npm ci` (a committed, in-sync
  `server/package-lock.json` is now the source of truth — the Dockerfiles build
  with `npm ci`, so do not regenerate it casually).

---

## Cleanup-loop — PERSISTENT RULES (do not drop these on compaction)

There is an iterative multi-agent **cleanup-loop** in `agents/cleanup-loop/`. Its
job: clean, simplify, and remove over-engineering from this codebase, one module
at a time. Full architecture + launch instructions: `agents/cleanup-loop/README.md`.
Criteria framework: the `clean-code` project skill (`.claude/skills/clean-code/`).

### Guiding principle
**The best code is the one that was never written.** When cleaning, prefer
**DELETE > SIMPLIFY > REWRITE**. Deleting dead code and speculative abstractions
beats prettifying them.

### Orchestrator protocol (one module per iteration)
The main session is the orchestrator. Each iteration:
1. Read `agents/cleanup-loop/queue.json`. If `scanComplete:false`, run the
   **initial scan** first: fan out `cleanup-scanner` subagents in parallel over
   repo partitions, merge their findings into `queue.pending`, set
   `scanComplete:true`, persist.
2. `cleanup-selector` → pick next module (or `done` → **stop the loop**).
3. `cleanup-test-guardian` → ensure a test safety net exists; write minimal
   F.I.R.S.T. tests if missing. No change is approved without a net.
4. `cleanup-simplifier` (isolated context) → apply **ONE atomic change**.
5. `cleanup-verifier` → run the gate; **commit on green**, **non-destructive
   rollback on red**.
6. `cleanup-logger` → append an entry to `agents/cleanup-loop/log.md`.
7. Update `queue.json` (stats, module status). **Persist every step.**

### Loop rules (hard constraints)
- **One atomic change per step**, always reversible — **one commit per change**
  (`refactor(cleanup): <module> — <what+why>`). Stage only the file(s) you
  touched (`git add <path>`); the repo has a large pre-existing uncommitted
  working tree — **never `git add -A`/`git add .`**, it would sweep the user's
  in-flight work into your commit.
- **Never advance with a broken build or red tests.** Gate must be green to commit.
- **Repeat the SAME module** turn-after-turn until its exit condition holds; only
  then move to the next. The loop is governed by **exit condition, not a timer** —
  never schedule it on a cron interval.
- **Respect existing style, conventions, and libraries — introduce NONE new** (no
  new dependency, framework, or pattern the codebase doesn't already use).
- **Attempt limit:** after **2 consecutive failed attempts** on a module,
  diagnose the root cause and mark it `manual_review` in `queue.json`. Do not
  keep patching incrementally — step back and switch approach, or defer.
- Never weaken trust boundaries in the name of brevity: input validation,
  auth/permission checks, error handling that prevents data loss, and security
  measures are **not** "over-engineering."

### Command prohibitions (rollback is non-destructive ONLY)
Allowed undo: `git revert --no-edit <hash>`, `git checkout -- <file>`,
`git restore`. **NEVER** use `git reset --hard`, `git clean -f`,
`git push --force`, `git branch -D`, `git rebase`, `rm -rf`, or any recursive
force-delete. These are blocked by `permissions.deny` AND the PreToolUse content
hook (`.claude/hooks/block-dangerous.sh`) — attempts will be rejected.

### Per-module exit condition (all must hold to mark `completed`)
- Functions **< 20 lines**, each doing **one thing**.
- No dead code, empty wrappers, single-implementation interfaces, or speculative
  abstractions (YAGNI).
- No Law of Demeter violations; no null returned or passed.
- Descriptive, searchable names; comments only where they add value.
- **build + tests green** (`verify-gate.sh` exits 0).

### Launch
- `/goal` until the queue is drained (recommended), or `/loop` auto-paced (no
  interval). See `agents/cleanup-loop/README.md` for the exact commands. Do not
  use `/loop <interval>`.

---

## Git / safety
- Commit only the loop's own atomic cleanup changes; do not sweep in the user's
  pre-existing uncommitted working-tree changes beyond the file(s) you touched.
- Stay on `main` only if the user is already there; do not create/switch branches
  unless asked. Never push unless explicitly asked.
