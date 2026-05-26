# AGENTS.md

## Mission
A small CLI + GitHub Action that helps repos maintain consistent, safe agent instruction files (AGENTS.md, CLAUDE.md). Lints for dangerous patterns, scores quality, and generates templates informed by Karpathy's principles and real-world data from 2,500+ repos. Deliberately simple — no over-engineering.

## Stack
TypeScript / Node.js. Bundled with @vercel/ncc. Tested with Vitest. Linted with ESLint 10 (flat config).

## Local dev commands
- Install: `npm install`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm test`
- Build: `npm run build`
- Run CLI locally: `npm run dev -- <command>`

## Project structure
- `src/` — all source code (718 lines total)
  - `cli.ts` — CLI entry point and command routing
  - `index.ts` — GitHub Action entry point
  - `check.ts` — file validation and quality checks
  - `safety.ts` — safety lint rules (regex-based pattern matching)
  - `score.ts` — quality scoring (A-F grade, 100-point scale)
  - `detect.ts` — project stack auto-detection
  - `discover.ts` — multi-file agent config discovery
  - `templates.ts` — minimal and opinionated template definitions
  - `types.ts` — shared TypeScript interfaces
- `dist/` — bundled output (committed, checked by CI)
- `.github/workflows/` — CI, release, Dependabot

## Core principles
- **Think before coding** — clarify assumptions before writing code. Don't silently pick an interpretation.
- **Simplicity first** — implement the simplest solution. No premature abstractions, no config options nobody will use.
- **Surgical changes** — only modify what's necessary. Don't refactor surrounding code or "clean up" unrelated files.
- **Verify, don't trust** — run `npm test` and `npm run typecheck` before declaring any task complete.

## When to stop and ask
- The task requires adding a new dependency
- You're unsure which approach to take among multiple valid options
- The change would affect the public CLI or Action interface
- Something feels wrong or requirements seem contradictory
- Proceed without asking for: bug fixes, test additions, documentation updates, and changes with one obvious implementation

## Verification
A task is not done until all of these pass:
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm test` exits 0
- `npm run build` exits 0

## Output rules
- CLI output must be clear and scannable
- Safety warnings must explain *why* something is flagged
- Templates must be practical, not corporate fluff
- JSON output (`--json`) must be valid and parseable

## Safety rules
- Never execute arbitrary code from user AGENTS.md files
- Safety lint rules must have low false-positive rates
- Don't add network calls or "phone home" behavior
- Never log or expose user file contents beyond what's needed for findings

## Change rules
- If you add a CLI command, update README, help text, and CHANGELOG
- If you add a safety rule, add tests and update the README table
- If you change templates, update corresponding tests
- `dist/` must be rebuilt and committed — CI checks freshness
- AGENTS.md is the source of truth; CLAUDE.md derives from it

## Boundaries: always, ask first, never

**Always:**
- Run the full test suite before submitting
- Follow existing code patterns (regex-based rules, CheckResult/SafetyResult types)
- Provide evidence that your change works (test output, CLI output)

**Ask first:**
- Adding new dependencies (this project has zero non-Action runtime deps)
- Changing the CLI interface or Action inputs/outputs
- Modifying CI/CD workflows

**Never:**
- Commit secrets or credentials
- Remove or skip failing tests
- Add network calls, telemetry, or analytics
- Make changes outside the scope of the current task
- Fabricate test results or claim untested code works
