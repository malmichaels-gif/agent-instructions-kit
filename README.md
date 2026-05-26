# agent-instructions-kit

[![CI](https://github.com/malmichaels-gif/agent-instructions-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/malmichaels-gif/agent-instructions-kit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/malmichaels-gif/agent-instructions-kit)](https://github.com/malmichaels-gif/agent-instructions-kit/releases)

Agent instructions that won't embarrass you.

Generates the instruction files AI coding tools depend on—consistent, up-to-date, and free of security traps.

This repo helps you add and maintain:
- **AGENTS.md** (source of truth)
- **CLAUDE.md** (generated or synced)
- a lightweight **safety lint** for instruction-file nonsense (prompt-injection-y stuff)

It's deliberately simple:
- `init` generates files (informed by [Karpathy's principles](https://lucaberton.com/blog/karpathy-claude-md-llm-coding-principles-2026/) and [Boris Cherny's workflow](https://howborisusesclaudecode.com/))
- `check` enforces required sections + quality signals
- `safety` warns or fails CI (your choice)

<p align="center">
  <img src="docs/images/safety-check.png" alt="Safety check catching a prompt injection attempt" width="700">
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

Generates AGENTS.md + CLAUDE.md using a single template source.

### `check`

Validates required sections and quality signals from [2,500+ real-world repos](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/):

* required sections exist (Mission, Local dev commands)
* recommended sections present (Verification, Boundaries)
* file length is sane (<150 lines ideal, >300 warns hard)
* boundary constraints exist ("never", "don't" — agents need explicit limits)
* sections have executable commands (prose-only sections degrade performance)
* CLAUDE.md is consistent with AGENTS.md (cross-file contradiction check)

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

---

## Configuration

### Action inputs

| Input            | Default     | Description                           |
| ---------------- | ----------- | ------------------------------------- |
| `mode`           | `check`     | `check` or `safety` or `all`          |
| `template`       | `minimal`   | `minimal` or `opinionated` (for init) |
| `fail_on_safety` | `false`     | Fail CI if safety rules hit           |
| `agents_path`    | `AGENTS.md` | Path to AGENTS.md                     |
| `claude_path`    | `CLAUDE.md` | Path to CLAUDE.md                     |

### Ignore file (optional)

Create `.aikignore` with rule IDs you want to suppress (use sparingly).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
Scope is intentionally tight. If your idea makes this repo bigger than it needs to be, it's probably a "no."

---

## License

MIT.

---

Built by HeyTC.
