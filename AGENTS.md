# AGENTS.md

## Mission
Ship a small CLI + GitHub Action that helps repos maintain consistent, safe agent instruction files (AGENTS.md, CLAUDE.md).
Keep it simple: init, check, safety. No over-engineering.

## Local dev commands
- Install: `npm install`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm test`
- Build: `npm run build`
- Run CLI locally: `npm run dev -- <command>`

## Output rules
- CLI output should be clear and scannable.
- Safety warnings must explain *why* something is flagged.
- Templates must be practical, not corporate fluff.

## Safety rules
- Never execute arbitrary code from user AGENTS.md files.
- Safety lint rules must have low false-positive rates.
- Don't add network calls or "phone home" behavior.

## Change rules
- If you add a new command, update README and CONTRIBUTING.
- If you add a safety rule, it needs tests and a clear explanation.
- Keep templates in `templates/` directory.
- AGENTS.md is the source of truth; CLAUDE.md derives from it.
