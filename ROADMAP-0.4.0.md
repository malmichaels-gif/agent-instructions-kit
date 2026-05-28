# v0.4.0 Roadmap

Target: June 2026

## High Priority

### 1. `fix` command
Auto-fix what the linter catches — like `eslint --fix` for agent instructions.

**What it could fix:**
- Add missing required sections from template
- Redact detected secrets (replace with `[REDACTED]`)
- Replace common hedge words with concrete alternatives
- Add missing AGENTS.md reference to CLAUDE.md

**What it should NOT fix (just warn):**
- Boundary/constraint decisions (those need human judgment)
- Section content beyond structure

### 2. Token budget estimate
Anthropic's 2026 Trends Report: context engineering is the key developer skill. More tokens makes agents worse — the right tokens matter.

**Implementation:**
- Estimate token count for each file (rough: chars / 4)
- Show percentage of typical context window consumed
- Warn if instruction files consume >5% of context
- Display in `score` output: `Token budget: ~1,200 tokens (1.2% of 100k window)`

**Source:** https://www.morphllm.com/context-engineering

### 3. Score badge generation
Auto-generate a shields.io badge for READMEs:

```markdown
![Agent Instructions Score: A](https://img.shields.io/badge/agent--instructions-A-brightgreen)
```

**Implementation:**
- New `--badge` flag on `score` command
- Outputs markdown snippet to paste into README
- Or writes badge SVG to `docs/images/` directly
- GitHub Action could auto-update badge via PR

## Medium Priority

### 4. GEMINI.md generation and linting
Gemini CLI adoption is growing. Same pattern as CLAUDE.md — a thin file that defers to AGENTS.md.

**Implementation:**
- `init` generates GEMINI.md alongside CLAUDE.md
- `check` validates GEMINI.md the same way it validates CLAUDE.md
- Cross-file consistency check between all three files

### 5. AGENTS.md v1.1 frontmatter support
Spec proposal #135 adds optional `description` and `tags` YAML frontmatter fields. Useful for monorepos where agents need to index multiple AGENTS.md files without reading every body.

**Implementation:**
- Parse YAML frontmatter if present
- Validate `description` and `tags` fields
- Warn if monorepo (multiple AGENTS.md files) lacks frontmatter
- Don't require it — v1.1 fields are optional

**Source:** https://agents.md/

### 6. Watch mode
`npx agent-instructions-kit watch` — re-scores on file save during AGENTS.md authoring.

## Lower Priority / Exploratory

### 7. Diff-aware safety in CI
Run safety only on changed lines in a PR, not the whole file. Reduces noise for large existing files being incrementally improved.

### 8. Hook suggestions
Based on the verification section in AGENTS.md, suggest Claude Code hook configurations:

```
Detected: "npm test exits 0" in your Verification section.
Suggested hook (add to .claude/settings.json):
  "hooks": { "Stop": [{ "command": "npm test" }] }
```

### 9. Rule customization via config
`.aikconfig.json` for tuning thresholds:
- Custom line limits
- Rule severity overrides (error → warn, warn → off)
- Additional custom regex rules
- Ignore patterns beyond `.aikignore`

## Out of scope — separate project

### agent-skills-kit (future, separate npm package)
SKILL.md linting is a different domain — skill activation semantics, script validation, YAML frontmatter schemas. It doesn't fit this tool's core, which is **instruction files** (AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules). These are all the same shape: markdown with sections, rules, and commands.

SKILL.md is a different shape: frontmatter-driven, directory-based, with scripts and assets. Adding it here would widen the tool beyond its purpose.

A separate `agent-skills-kit` package could:
- Validate SKILL.md frontmatter (name, description, triggers)
- Check that referenced scripts exist
- Run the same safety rules on instruction markdown
- Share a core with this package if it makes sense later

The SKILL.md ecosystem grew 18.5x in 20 days (CMU/Bosch, Feb 2026) and nobody lints these files yet. It's a real opportunity — just not for this tool.

## Launch: "State of AGENTS.md" scan

Ship alongside v0.4.0. Run the tool against hundreds of real public AGENTS.md files on GitHub and publish the findings as a blog post / LinkedIn article.

**What to measure:**
- Score distribution (how many A/B/C/D/F)
- % with hardcoded secrets
- % with no boundary constraints
- % with ambiguous hedge words
- % with missing verification sections
- Most common safety findings
- Average file length vs. recommended <150 lines
- Token budget consumption

**Why this matters for adoption:**
Original data nobody else has. Dev newsletters and Twitter/X pick up concrete, surprising findings — not "I built a tool" but "here's what we found." The punchline of every post: *"We used agent-instructions-kit to run this scan. You can check your own repo in one command."*

**How to do it:**
- Use GitHub API to find repos with AGENTS.md (`gh search code --filename AGENTS.md`)
- Clone/download the files, run `agent-instructions-kit score --json` and `safety --json` on each
- Aggregate into a dataset, write up the findings
- Publish with charts and the raw data

## Research / Watch

- **Multi-agent instruction scoping** — as managed agents and orchestration mature, instruction files may need to declare which agent role they target. Watch Anthropic's Managed Agents and Outcomes features.
- **ContextCov** — academic paper (arxiv 2603.00822) on deriving executable constraints from agent instruction files. Could inform more sophisticated validation beyond regex.
- **Just-in-time context** — Anthropic's pattern for long-running agents. May affect how instruction files should be structured for progressive loading.

## References

- [Anthropic 2026 Agentic Coding Trends Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf)
- [Context Engineering — Morph](https://www.morphllm.com/context-engineering)
- [Code with Claude 2026 — Simon Willison](https://simonwillison.net/2026/May/6/code-w-claude-2026/)
- [Linux Foundation AAIF announcement](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
- [Boris Cherny on Claude Code customization](https://howborisusesclaudecode.com/)
- [AGENTS.md patterns — Blake Crosley](https://blakecrosley.com/blog/agents-md-patterns)
- [SKILL.md Specification](https://agentskills.io/specification)
