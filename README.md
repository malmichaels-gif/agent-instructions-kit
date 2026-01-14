# agent-instructions-kit

[![CI](https://github.com/malmichaels-gif/agent-instructions-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/malmichaels-gif/agent-instructions-kit/actions/workflows/ci.yml)

Agent instructions that won't embarrass you.

This repo helps you add and maintain:
- **AGENTS.md** (source of truth)
- **CLAUDE.md** (generated or synced)
- a lightweight **safety lint** for instruction-file nonsense (prompt-injection-y stuff)

It's deliberately simple:
- `init` generates files
- `check` enforces required sections
- `safety` warns or fails CI (your choice)

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

* **minimal**: just the essentials (setup, tests, style, PR rules)
* **opinionated**: adds security notes, "what not to do", and guardrails

Example:

```bash
npx agent-instructions-kit init --template opinionated
```

---

## Commands

### `init`

Generates AGENTS.md + CLAUDE.md using a single template source.

### `check`

Validates:

* required sections exist
* basic formatting is sane
* files are not empty placeholders

### `safety`

Flags suspicious patterns commonly used for instruction hijacking or bad behavior, like:

* "ignore previous instructions"
* "print env vars / secrets"
* "upload repo contents"
* "curl | bash from random URL"
* "disable security checks"

You choose whether safety findings:

* **warn** (default)
* **fail** CI (`fail_on_safety: true`)

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
