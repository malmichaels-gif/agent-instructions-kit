# agent-instructions-kit

[![CI](https://github.com/malmichaels-gif/agent-instructions-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/malmichaels-gif/agent-instructions-kit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/malmichaels-gif/agent-instructions-kit)](https://github.com/malmichaels-gif/agent-instructions-kit/releases)

Agent instructions that won't embarrass you.

Generates the instruction files AI coding tools depend on—consistent, up-to-date, and free of security traps.

This repo helps you add and maintain:
- **AGENTS.md** (source of truth)
- **CLAUDE.md** (generated or synced)
- **GEMINI.md** (optional, defers to AGENTS.md — treated like CLAUDE.md)
- a lightweight **safety lint** for instruction-file nonsense (prompt-injection-y stuff)

It's deliberately simple:
- `init` generates files (informed by [Karpathy's principles](https://lucaberton.com/blog/karpathy-claude-md-llm-coding-principles-2026/) and [Boris Cherny's workflow](https://howborisusesclaudecode.com/))
- `check` enforces required sections + quality signals
- `safety` warns or fails CI (your choice)

<p align="center">
  <img src="docs/images/score-output.svg" alt="Score command grading instruction files A through F" width="600">
</p>

<p align="center">
  <img src="docs/images/safety-check.svg" alt="Safety check catching prompt injection, leaked secrets, and identity override" width="700">
</p>

---

## Why this exists

Agent instruction files are becoming normal. Great.

But then:
- the files drift
- people paste "ignore previous instructions" garbage
- someone "helpfully" suggests exfiltrating secrets
- your agent starts doing... weird things

This kit keeps your repo's agent instructions **consistent** and **less stupid**.

---

## Quickstart (CLI)

### 1) Generate files

```bash
npx agent-instructions-kit init
```

This creates:

* `AGENTS.md` (source of truth)
* `CLAUDE.md` (derived from AGENTS.md)
* `GEMINI.md` (derived from AGENTS.md)

### 2) Customize AGENTS.md

Edit the setup/test commands and repo rules.

### 3) (Optional) Add CI check

```yaml
name: Agent Instructions Check

on:
  pull_request:
  push:
    branches: [ main ]

permissions:
  contents: read

jobs:
  agent_instructions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: malmichaels-gif/agent-instructions-kit@v0
        with:
          mode: "check"
          fail_on_safety: "false" # set true if you want it to block
```

---

## What `init` generates

`init` auto-detects your stack (Node.js, Rust, Python, Go) and pre-fills templates with real commands, framework, and language — no placeholder editing needed.

You get two template flavors:

* **minimal**: essentials — mission, stack, commands, verification, boundaries
* **opinionated**: adds Karpathy's four principles (think-first, simplicity, surgical changes, verify-don't-trust), boundary tiers (always/ask first/never), a "when to stop and ask" decision framework, and exit-code-based verification

Example:

```bash
npx agent-instructions-kit init --template opinionated
```

---

## Commands

### `init`

Generates AGENTS.md + CLAUDE.md + GEMINI.md. Auto-detects your project stack and fills in real commands. CLAUDE.md and GEMINI.md are thin files that defer to AGENTS.md as the single source of truth.

### `check`

Validates required sections and quality signals from [2,500+ real-world repos](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/):

* required sections exist (Mission, Local dev commands)
* recommended sections present (Verification, Boundaries)
* file length is sane (<150 lines ideal, >300 warns hard)
* boundary constraints exist ("never", "don't" — agents need explicit limits)
* sections have executable commands (prose-only sections degrade performance)
* CLAUDE.md and GEMINI.md (if present) are consistent with AGENTS.md (cross-file contradiction check)
* cross-file consistency across AGENTS.md / CLAUDE.md / GEMINI.md (contradictions + verbatim duplication)
* optional AGENTS.md v1.1 frontmatter (`description`, `tags`) is validated when present

GEMINI.md is optional — if it's absent, `check` skips it without failing. Pass `--gemini <path>` to use a custom location.

#### Claude Code hook suggestions

`check` reads the verifiable commands in your **Verification** section and suggests matching [Claude Code hooks](https://docs.claude.com/en/docs/claude-code/hooks). For example, a Verification section containing `` `npm test` exits 0 `` and `` `npm run build` exits 0 `` prints a ready-to-paste `.claude/settings.json` snippet that runs those commands on the `Stop` hook, so the agent re-verifies its work before finishing:

```jsonc
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "npm test && npm run build" } ] }
    ]
  }
}
```

Only backtick-wrapped commands whose leading token is a recognized build/test tool (npm, pnpm, yarn, cargo, go, pytest, poetry, uv, ruff, make, etc.) are suggested, keeping false positives low. Suggestions are advisory and never affect the check's pass/fail result. With `--json`, the suggestions are available under `agents.hookSuggestions`.

#### AGENTS.md v1.1 frontmatter (optional)

AGENTS.md may begin with an optional YAML frontmatter block describing the file:

```markdown
---
description: Backend service — REST API and workers
tags: [backend, api]
---

# AGENTS.md
...
```

Frontmatter is purely additive — files without it pass all checks unchanged. When present, `check`:

* validates `description` is a non-empty string (if present)
* validates `tags` is a non-empty list of strings (if present)
* excludes frontmatter from line-length thresholds (it's metadata, not instructions)

In a **monorepo** (multiple `AGENTS.md` files discovered in the tree), `check` warns when a file lacks frontmatter so the different files can be told apart by their `description`. This is a recommendation, never an error.

Note: safety rules run on the full file, including frontmatter. If a `description`/`tags` value trips a safety pattern, suppress it via the ignore file (see below).

### `safety`

Flags suspicious patterns commonly used for instruction hijacking or bad behavior.

#### What gets flagged

| Rule ID                | Severity | What it catches                            | Example trigger                            |
| ---------------------- | -------- | ------------------------------------------ | ------------------------------------------ |
| `ignore-instructions`  | error    | Prompt injection attempts                  | "ignore previous instructions"             |
| `print-secrets`        | error    | Credential exfiltration                    | "print env vars", "print api keys"         |
| `upload-repo`          | error    | Repository exfiltration                    | "upload repository contents"               |
| `exfiltrate`           | error    | Generic data exfiltration                  | "send data to external server"             |
| `override-instructions`| error    | Overriding system prompts                  | "override system instructions"             |
| `new-identity`         | error    | Agent identity hijacking                   | "you are now", "forget you are"            |
| `hidden-instructions`  | error    | Malicious HTML comments                    | `<!-- ignore all rules -->`                |
| `mcp-tool-abuse`       | error    | Destructive MCP tool calls                 | "use_mcp_tool to delete"                   |
| `leaked-aws-key`       | error    | AWS access keys in markdown                | `AKIAIOSFODNN7EXAMPLE`                     |
| `leaked-generic-secret`| error    | Hardcoded API keys / tokens                | `api_key: "sk-1234..."`                    |
| `leaked-private-key`   | error    | Private keys in markdown                   | `-----BEGIN RSA PRIVATE KEY-----`          |
| `leaked-jwt`           | error    | JWT tokens in markdown                     | `eyJhbG...`                                |
| `curl-bash`            | warn     | Piping untrusted URLs to shell             | `curl https://... \| bash`                 |
| `disable-security`     | warn     | Disabling security controls                | "disable verification", "disable checks"   |
| `base64-obfuscation`   | warn     | Encoded/obfuscated payloads                | "base64 decode", "eval(atob(...))"         |
| `webhook-exfil`        | warn     | Sending data to external services          | "send to webhook", "post data to http"     |
| `ambiguous-hedge`      | warn     | Vague instructions that degrade performance| "try to", "where possible", "if appropriate"|
| `vague-persona`        | warn     | Generic role definitions                   | "you are a helpful assistant"              |

Rules with severity **error** cause `safety` to report `passed: false`. Rules with severity **warn** are reported but don't fail the check.

You choose whether safety failures block CI:

* **warn only** (default) — findings are reported but CI passes
* **fail CI** (`fail_on_safety: true`) — errors block the pipeline

#### `fail_on_safety` behavior

| `fail_on_safety` | Error-level finding | Warn-level finding | CI result |
| ----------------- | ------------------- | ------------------- | --------- |
| `false` (default) | Reported as warning  | Reported as warning  | Pass      |
| `true`            | Reported as error    | Reported as warning  | **Fail**  |

Example — fail CI on safety errors:

```yaml
- uses: malmichaels-gif/agent-instructions-kit@v0
  with:
    mode: "safety"
    fail_on_safety: "true"
```

Example — run both checks, warn only:

```yaml
- uses: malmichaels-gif/agent-instructions-kit@v0
  with:
    mode: "all"
    fail_on_safety: "false"
```

#### Diff-aware safety (`--diff` / `diff_mode`)

On large, pre-existing instruction files, a freshly enabled safety check can surface a wall of findings on lines nobody touched in the current change. Diff-aware mode trims the noise: it reads the current `git diff` and reports safety findings **only on lines that changed**.

```bash
npx agent-instructions-kit safety --diff
npx agent-instructions-kit safety --diff --fail   # block CI on changed-line errors
```

`--changed-only` is accepted as an alias for `--diff`.

In a GitHub Action, set `diff_mode: "force"`:

```yaml
- uses: malmichaels-gif/agent-instructions-kit@v0
  with:
    mode: "safety"
    diff_mode: "force"      # off (default) or force; "true" is accepted as an alias
    fail_on_safety: "true"
```

Notes:

* **Default is off** — without the flag/input, safety scans the entire file (unchanged behavior).
* **Requires git** — diff mode reads `git diff HEAD`. If git is unavailable or the directory is not a repository, it logs a warning and falls back to scanning the full file (never fails for this reason alone).
* **Trade-off** — this reduces noise, it does not find everything. A pre-existing malicious line on an untouched line is intentionally suppressed in diff mode. Run plain `safety` (no `--diff`) to audit the whole file.
* **Scoring is unaffected** — the quality `score` always evaluates the full file, so diff mode never inflates your grade.

### `score`

Grades your instruction files on a 100-point scale (A through F) across four categories:

* **Structure** (30 pts) — required sections, recommended sections, boundary constraints, executable commands
* **Safety** (30 pts) — no dangerous patterns, no leaked secrets
* **Clarity** (20 pts) — file length, no ambiguous language, no vague personas
* **Consistency** (20 pts) — CLAUDE.md and GEMINI.md reference and align with AGENTS.md, with no cross-file contradictions or duplication

It also reports a **token budget** estimate — roughly how many tokens your instruction files (AGENTS.md + CLAUDE.md + GEMINI.md) consume and what share of a typical 100k-token context window that is. The estimate uses a `chars / 4` heuristic (actual token counts vary by content — code is denser than prose), and it warns when the files exceed 5% of the window:

```text
Token budget: ~1,200 tokens (1.2% of 100k window)
```

The `--json` output includes a `tokenBudget` object with `estimatedTokens`, `percentOfWindow`, and `isWarning`.

```bash
npx agent-instructions-kit score
npx agent-instructions-kit score --json   # machine-readable output
```

#### Score badge

Add `--badge` to print a [shields.io](https://shields.io) badge for the current grade — paste it into your README to show off your instruction quality. The color maps to the grade (A → brightgreen, B → green, C → yellow, D → orange, F → red):

```bash
npx agent-instructions-kit score --badge
# ![Agent Instructions Score: A](https://img.shields.io/badge/agent--instructions-A-brightgreen)
```

Use `--badge-format svg` to emit a self-contained SVG (no network dependency) and `--badge-output <path>` to write the badge to a file:

```bash
npx agent-instructions-kit score --badge --badge-format svg --badge-output badge.svg
```

With `--json`, the badge is included as `badge` (and `badgeFormat`) alongside the score. The output directory must already exist.

### `fix`

Auto-fixes the common issues the linter catches (like `eslint --fix`). It applies only safe, structural changes and leaves judgement calls (boundary/constraint wording, section bodies) to you:

* **Adds missing required sections** (`## Mission`, `## Local dev commands`) with starter stubs
* **Redacts detected secrets** — leaked AWS keys, generic API keys/tokens, private keys, and JWTs are replaced with `[REDACTED]`
* **Adds the AGENTS.md reference** to CLAUDE.md when it's missing

It also **flags ambiguous hedge words** (`try to`, `where possible`, `if appropriate`, …) for manual review, but does **not** rewrite them — turning vague prose into a concrete requirement needs your judgement, and a blind word swap mangles grammar. It does **not** rewrite boundary/constraint decisions or section content beyond structure either — run `check` and `score` for those.

```bash
npx agent-instructions-kit fix
npx agent-instructions-kit fix --dry-run   # preview changes without writing
npx agent-instructions-kit fix --json      # machine-readable fix report
```

### `watch`

Watches `AGENTS.md` (and `CLAUDE.md`) for changes while you author them and re-scores on every save — a fast feedback loop for getting your grade up. It uses Node's built-in `fs.watch` (no extra dependency), debounces rapid saves (default 300ms), and prints the updated grade each time:

```bash
npx agent-instructions-kit watch
npx agent-instructions-kit watch --debounce 500   # custom debounce (ms)
```

```text
Watching AGENTS.md and CLAUDE.md for changes (debounce 300ms)...
Initial Grade: B (84/100)
Press Ctrl+C to stop.

[10:20:31] AGENTS.md changed -> Grade: A (92/100)
```

Press `Ctrl+C` to stop. Notes:

* This is a development-time helper — it does not exit with a non-zero status and is not meant for CI.
* `fs.watch` is platform-dependent; local filesystems are recommended (network mounts like NFS/SMB may not emit reliable events).
* Watch both files together so cross-file consistency stays accurate.

### `--json` output

All commands except `init` support `--json` for structured output:

```bash
npx agent-instructions-kit check --json
npx agent-instructions-kit safety --json
```

### `--discover` (multi-file)

`safety --discover` scans additional agent config files alongside AGENTS.md:

* `.github/copilot-instructions.md`
* `.cursor/rules`, `.cursorrules`
* `.windsurfrules`
* `.aider/conventions.md`

```bash
npx agent-instructions-kit safety --discover
```

---

## Configuration

### Action inputs

| Input            | Default     | Description                           |
| ---------------- | ----------- | ------------------------------------- |
| `mode`           | `check`     | `check` or `safety` or `all`          |
| `template`       | `minimal`   | `minimal` or `opinionated` (for init) |
| `fail_on_safety` | `false`     | Fail CI if safety rules hit           |
| `diff_mode`      | `off`       | `off` or `force` — diff-aware safety  |
| `agents_path`    | `AGENTS.md` | Path to AGENTS.md                     |
| `claude_path`    | `CLAUDE.md` | Path to CLAUDE.md                     |
| `gemini_path`    | `GEMINI.md` | Path to GEMINI.md (optional)          |

### Ignore file (optional)

Create `.aikignore` with rule IDs you want to suppress (use sparingly).

### Config file (optional)

Drop a `.aikconfig.json` at the repo root to tune rules. Everything is optional and fully backward compatible — with no file present, defaults apply. Unknown keys and invalid values are reported as warnings (never fatal).

```json
{
  "check": {
    "lineWarnThreshold": 120,
    "lineErrorThreshold": 250
  },
  "safety": {
    "severityOverrides": {
      "curl-bash": "error",
      "ambiguous-hedge": "off"
    },
    "ignoreRules": ["vague-persona"],
    "customRules": [
      {
        "id": "no-internal-host",
        "pattern": "internal\\.example\\.com",
        "message": "Do not reference internal hostnames in instruction files",
        "severity": "error"
      }
    ]
  }
}
```

| Key                       | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `check.lineWarnThreshold` | Override the 150-line warning threshold for AGENTS.md                  |
| `check.lineErrorThreshold`| Override the 300-line "trim aggressively" threshold                    |
| `safety.severityOverrides`| Map of built-in rule id -> `warn` \| `error` \| `off` (`off` disables) |
| `safety.ignoreRules`      | Rule ids to suppress (merged with `.aikignore`)                        |
| `safety.customRules`      | User-defined rules: `{ id, pattern, message, severity? }`              |

Custom rule `pattern`s are compiled case-insensitively. A custom rule whose `id` matches a built-in rule overrides it. Patterns that fail to compile (or look like ReDoS) are skipped with a warning.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
Scope is intentionally tight. If your idea makes this repo bigger than it needs to be, it's probably a "no."

---

## License

MIT.

---

Built by HeyTC.
