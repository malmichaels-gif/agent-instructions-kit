import type { HookSuggestion } from './types.js';

// Heuristic parsing of the AGENTS.md "Verification" section into Claude Code
// hook suggestions. The idea: if a project documents that "`npm test` exits 0"
// is part of its definition of done, that command is a natural fit for a Stop
// hook in .claude/settings.json so the agent re-runs it before finishing.
//
// We deliberately keep this conservative to avoid false positives:
//   - Only the Verification section (or a Testing/Verify heading) is scanned.
//   - Only backtick-wrapped commands are considered (prose is ignored).
//   - Only commands whose leading token matches a known build/test tool are
//     suggested (npm/pnpm/yarn/cargo/go/pytest/poetry/uv/ruff/make).
// All suggestions map to the Stop hook, which fires when the agent finishes a
// response — the right moment to assert "is the work actually verified?".

// Headings whose body we treat as the verification section. Matched against
// `## <heading>` lines, case-insensitively.
const VERIFICATION_HEADING = /testing|verification|verify|test plan|definition of done/i;

// Leading command tokens we recognize as verifiable build/test commands. Mirrors
// the tools understood by detect.ts so the two stay roughly aligned.
const KNOWN_COMMAND_LEADERS = new Set([
  'npm',
  'pnpm',
  'yarn',
  'cargo',
  'go',
  'pytest',
  'poetry',
  'uv',
  'ruff',
  'flake8',
  'make',
  'mypy',
  'tsc',
  'eslint',
  'golangci-lint',
]);

// A command must start with a known leader (optionally via a runner like
// `npm run`). We extract the backtick-wrapped contents first, then validate.
const BACKTICK_GLOBAL = /`([^`]+)`/g;

/**
 * Extract the body lines of the verification section from an AGENTS.md content
 * string. Returns the lines between the matching `## heading` and the next `##`
 * heading (exclusive). Returns an empty array when no verification section is
 * present.
 */
function extractVerificationLines(content: string): string[] {
  const lines = content.split('\n');
  const body: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      if (inSection) break; // reached the next section
      inSection = VERIFICATION_HEADING.test(headingMatch[1]);
      continue;
    }
    if (inSection) body.push(line);
  }

  return body;
}

/**
 * Normalize a raw backtick command into the canonical command we would run in a
 * hook, or null if it is not a recognized verifiable command.
 *
 * Examples:
 *   "npm test"            -> "npm test"
 *   "npm run build"       -> "npm run build"
 *   "cargo test --release"-> "cargo test --release"
 *   "see the docs"        -> null
 */
function normalizeCommand(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;

  const tokens = trimmed.split(' ');
  const leader = tokens[0].toLowerCase();
  if (!KNOWN_COMMAND_LEADERS.has(leader)) return null;

  // Guard against accidental matches like a bare tool name with no action
  // (e.g. just `npm`), which is not a meaningful hook command.
  if (tokens.length < 2 && leader !== 'pytest' && leader !== 'flake8') {
    return null;
  }

  return trimmed;
}

/**
 * Parse the Verification section of an AGENTS.md content string and return
 * suggested Claude Code hooks. Each recognized verification command becomes a
 * Stop-hook suggestion. Duplicate commands are de-duplicated.
 */
export function suggestHooks(content: string): HookSuggestion[] {
  const suggestions: HookSuggestion[] = [];
  const seen = new Set<string>();

  const verificationLines = extractVerificationLines(content);
  if (verificationLines.length === 0) return suggestions;

  for (const line of verificationLines) {
    for (const match of line.matchAll(BACKTICK_GLOBAL)) {
      const command = normalizeCommand(match[1]);
      if (!command || seen.has(command)) continue;
      seen.add(command);
      suggestions.push({
        hookType: 'Stop',
        command,
        description: `Run \`${command}\` automatically when the agent finishes (it's part of your Verification section)`,
      });
    }
  }

  return suggestions;
}

/**
 * Render the suggested hooks as a `.claude/settings.json` snippet so users can
 * copy it directly. Returns null when there are no suggestions. All matching
 * commands are combined into a single Stop hook (chained with `&&`) since
 * Claude Code runs one command per hook entry.
 */
export function renderHookSettings(suggestions: HookSuggestion[]): string | null {
  if (suggestions.length === 0) return null;

  const command = suggestions.map((s) => s.command).join(' && ');
  const settings = {
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command,
            },
          ],
        },
      ],
    },
  };

  return JSON.stringify(settings, null, 2);
}
