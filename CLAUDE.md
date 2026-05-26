Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.

## Claude Code workflow

### Planning
- For non-trivial tasks (3+ steps or architectural decisions), write a plan first
- If something goes sideways, STOP and re-plan — don't keep pushing

### Subagents
- Use subagents for research, exploration, and parallel analysis
- Keep main context focused — one task per subagent

### Self-improvement
- After ANY correction, update CLAUDE.md with a rule to prevent the same mistake

### Tech currency
- Current year is 2026 — your training may be outdated
- Before implementing significant features, search for current best practices
- Flag when you're unsure if an approach is still recommended
