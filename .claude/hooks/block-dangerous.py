#!/usr/bin/env python3
"""Content-based block list for destructive shell commands (cleanup-loop hook).

Reads a Claude Code PreToolUse payload on stdin and exits 2 to VETO the call
when the command text matches a destructive pattern. The matcher is intentionally
content-based, not name-based: a `permissions.deny` rule keyed on "git" can be
dodged by `/usr/bin/git` or an env-var prefix, but these regexes scan the raw
command string and every pipe/&&/||/; segment within it.

Design notes:
- Fails OPEN on any parse error (exit 0). The goal is to stop the loop from
  fat-fingering an irreversible command, not to sandbox an adversary. A crash in
  the guard must never wedge the whole session.
- Only inspects Bash. Edit/Write/Read are governed by settings permissions.
- Patterns favor false-positives over false-negatives on the truly destructive
  families (recursive force-delete, history rewrite, hard reset, force push).
  The loop's own workflow (git revert, git checkout -- <file>, git commit) is
  explicitly NOT matched.
"""
import json
import re
import sys

# Each entry: (human-readable reason, compiled regex tested against the full
# command AND each split segment). re.X for readability; re.I for flag casing.
_PATTERNS = [
    (
        "rm with recursive+force (rm -rf / rm -fr / --recursive --force)",
        r"""\brm\b (?=[^\n|;&]* (?: -[a-eg-z]*r[a-eg-z]*f | -[a-eg-z]*f[a-eg-z]*r
            | --recursive | --force ))""",
    ),
    (
        "rm -r / rm -f targeting a root-ish or wildcard path",
        r"""\brm\b \s+ (?:-\S+\s+)* (?: / | ~ | \. | \.\. | \$HOME | \* )""",
    ),
    ("git reset --hard (discards working tree irreversibly)",
     r"""\bgit\b [^\n|;&]* \breset\b [^\n|;&]* --hard"""),
    ("git clean -f / -fd (deletes untracked files irreversibly)",
     r"""\bgit\b [^\n|;&]* \bclean\b [^\n|;&]* (?: -[a-z]*f | --force )"""),
    ("git push --force / -f / --force-with-lease (history rewrite on remote)",
     r"""\bgit\b [^\n|;&]* \bpush\b [^\n|;&]* (?: --force | --force-with-lease | (?<!\S)-\S*f )"""),
    ("git branch -D / --delete --force (force-deletes a branch)",
     r"""\bgit\b [^\n|;&]* \bbranch\b [^\n|;&]* (?: -[a-zA-Z]*D | --delete\s+--force | --force )"""),
    ("git checkout -f / --force (discards local changes)",
     r"""\bgit\b [^\n|;&]* \bcheckout\b [^\n|;&]* (?: --force | (?<!\S)-\S*f )"""),
    ("git rebase (history rewrite — out of scope for atomic single-commit loop)",
     r"""\bgit\b [^\n|;&]* \brebase\b"""),
    ("git filter-branch / filter-repo (mass history rewrite)",
     r"""\bgit\b [^\n|;&]* \bfilter-(?:branch|repo)\b"""),
    ("git update-ref -d / reflog expire (destroys recovery points)",
     r"""\bgit\b [^\n|;&]* (?: update-ref \s+ -d | reflog \s+ expire )"""),
    ("dd onto a device / truncate -s shrink of a file",
     r"""(?: \bdd\b [^\n]* \bof=/dev/ | (?:^|[|;&]\s*) truncate \s+ -s )"""),
    ("chmod/chown -R on a root-ish path",
     r"""\b(?:chmod|chown)\b [^\n|;&]* -R [^\n|;&]* (?: / | ~ | \$HOME )(?:\s|$)"""),
    ("destructive mongo/mongosh drop (dropDatabase/dropCollection/deleteMany)",
     r"""(?: dropDatabase | dropCollection | \.drop\(\) | deleteMany\(\{\}\) )"""),
    ("rm of node_modules / dist / .git tree",
     r"""\brm\b [^\n|;&]* (?: node_modules | dist | \.git )(?:\b|/)"""),
    (":(){ fork bomb",
     r""":\(\)\s*\{\s*:\|:&\s*\}\s*;:"""),
]

_COMPILED = [(reason, re.compile(rx, re.X | re.I)) for reason, rx in _PATTERNS]

# Split on shell separators so a destructive command hidden after `&&`/`|`/`;`
# is still tested in isolation (defends against "safe_cmd && rm -rf x").
_SEGMENT_SPLIT = re.compile(r"(?:\|\||\||&&|;|&|\n)")


def _matches(command: str):
    haystacks = [command] + _SEGMENT_SPLIT.split(command)
    for reason, rx in _COMPILED:
        for h in haystacks:
            if rx.search(h):
                return reason
    return None


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        return 0
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        return 0  # fail open
    if payload.get("tool_name") != "Bash":
        return 0
    command = (payload.get("tool_input") or {}).get("command", "")
    if not isinstance(command, str) or not command.strip():
        return 0
    reason = _matches(command)
    if reason:
        sys.stderr.write(
            "BLOCKED by cleanup-loop safety hook: " + reason + ".\n"
            "Rollback must use `git revert` or `git checkout -- <file>` only "
            "(never reset --hard / clean -f / push --force). "
            "If a module truly cannot be cleaned without a destructive command, "
            "mark it manual_review in queue.json and move on.\n"
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
