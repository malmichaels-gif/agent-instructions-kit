import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { checkAgentsFile, checkClaudeFile, checkGeminiFile, checkCrossFileConsistency } from './check.js';

const TEST_DIR = './test-fixtures-check';

beforeEach(() => {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  try {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});

function writeAgents(name: string, content: string): string {
  const filePath = path.join(TEST_DIR, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

const VALID_AGENTS = `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- Install: \`npm install\`
- Test: \`npm test\`

## Verification
- Run \`npm test\` before declaring complete

## Boundaries
- Never commit secrets
`;

describe('checkAgentsFile', () => {
  it('fails if file does not exist', () => {
    const result = checkAgentsFile('./nonexistent.md');
    expect(result.passed).toBe(false);
    expect(result.errors).toContain('File not found: ./nonexistent.md');
  });

  it('fails if file is empty', () => {
    const filePath = writeAgents('empty.md', '');
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('empty');
  });

  it('fails if missing required sections', () => {
    const filePath = writeAgents('missing-sections.md', '# AGENTS.md\n\nSome content here.');
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('Mission'))).toBe(true);
  });

  it('passes with all required sections', () => {
    const filePath = writeAgents('valid.md', VALID_AGENTS);
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('warns about TODO placeholders', () => {
    const filePath = writeAgents('todo.md', `# AGENTS.md

## Mission
TODO: fill this in

## Local dev commands
- \`npm install\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('TODO'))).toBe(true);
  });

  it('warns when file exceeds 150 lines', () => {
    const header = '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n';
    const padding = Array(160).fill('- rule').join('\n');
    const filePath = writeAgents('long.md', header + padding);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('150'))).toBe(true);
  });

  it('warns harder when file exceeds 300 lines', () => {
    const header = '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n';
    const padding = Array(310).fill('- rule').join('\n');
    const filePath = writeAgents('very-long.md', header + padding);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('300'))).toBe(true);
  });

  it('uses custom line thresholds from options when provided', () => {
    const header = '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n';
    const padding = Array(60).fill('- rule').join('\n');
    const filePath = writeAgents('custom-threshold.md', header + padding);
    // Default thresholds (150/300) would not warn at ~68 lines, but a custom
    // warn threshold of 50 should.
    const result = checkAgentsFile(filePath, { lineWarnThreshold: 50, lineErrorThreshold: 500 });
    expect(result.warnings.some((w) => w.includes('50'))).toBe(true);
  });

  it('does not warn on line count when under custom thresholds', () => {
    const header = '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n';
    const padding = Array(160).fill('- rule').join('\n');
    const filePath = writeAgents('raised-threshold.md', header + padding);
    // Raising the thresholds well above the line count suppresses the default
    // 150-line warning.
    const result = checkAgentsFile(filePath, { lineWarnThreshold: 1000, lineErrorThreshold: 2000 });
    expect(result.warnings.some((w) => /\bline/i.test(w) && /\d{3,}/.test(w))).toBe(false);
  });

  it('falls back to default thresholds when options omitted (backward compatible)', () => {
    const header = '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n';
    const padding = Array(160).fill('- rule').join('\n');
    const filePath = writeAgents('default-threshold.md', header + padding);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('150'))).toBe(true);
  });

  it('warns when missing verification section', () => {
    const filePath = writeAgents('no-verify.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Verification'))).toBe(true);
  });

  it('warns when missing boundary section', () => {
    const filePath = writeAgents('no-bounds.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Verification
- Run \`npm test\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Boundaries'))).toBe(true);
  });

  it('warns when no boundary language exists at all', () => {
    const filePath = writeAgents('no-boundary-words.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Rules
- Run tests
- Update docs
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('boundary constraints'))).toBe(true);
  });

  it('does not warn about boundary language when "never" is present', () => {
    const filePath = writeAgents('has-never.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Rules
- Never commit secrets
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('boundary constraints'))).toBe(false);
  });

  it('warns about sections with prose but no commands', () => {
    const filePath = writeAgents('prose-only.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Code style
Follow the existing patterns in the codebase.
Use consistent naming conventions.
Make sure imports are organized.
Keep functions small and focused.
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Code style') && w.includes('no executable commands'))).toBe(true);
  });

  it('does not warn about sections that have backtick commands', () => {
    const filePath = writeAgents('has-commands.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Code style
- Run \`eslint src\` to check
- Format with \`prettier --write\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Code style') && w.includes('no executable commands'))).toBe(false);
  });

  it('skips prose check for Mission section', () => {
    const filePath = writeAgents('mission-prose.md', `# AGENTS.md

## Mission
This project is a CLI tool that helps
teams maintain consistent agent instruction
files across their repositories.

## Local dev commands
- \`npm test\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Mission') && w.includes('no executable commands'))).toBe(false);
  });

  it('parses and validates valid frontmatter without blocking validation', () => {
    const filePath = writeAgents('with-fm.md', `---
description: Backend service
tags: [backend, api]
---
${VALID_AGENTS}`);
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes('frontmatter'))).toBe(false);
  });

  it('warns for invalid frontmatter (empty description) without failing', () => {
    const filePath = writeAgents('bad-fm.md', `---
description:
tags: []
---
${VALID_AGENTS}`);
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('description'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('tags'))).toBe(true);
  });

  it('passes when a single AGENTS.md has no frontmatter (no monorepo warning)', () => {
    const filePath = writeAgents('no-fm.md', VALID_AGENTS);
    const result = checkAgentsFile(filePath, { agentsFileCount: 1 });
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('Multiple AGENTS.md'))).toBe(false);
  });

  it('warns when multiple AGENTS.md files exist but this one lacks frontmatter', () => {
    const filePath = writeAgents('no-fm-mono.md', VALID_AGENTS);
    const result = checkAgentsFile(filePath, { agentsFileCount: 3 });
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('Multiple AGENTS.md'))).toBe(true);
  });

  it('does not warn about monorepo when frontmatter is present', () => {
    const filePath = writeAgents('fm-mono.md', `---
description: Service A
---
${VALID_AGENTS}`);
    const result = checkAgentsFile(filePath, { agentsFileCount: 3 });
    expect(result.warnings.some((w) => w.includes('Multiple AGENTS.md'))).toBe(false);
  });

  it('excludes frontmatter lines from required-section checks', () => {
    // Frontmatter must be stripped so the "## Mission" inside content is still found.
    const filePath = writeAgents('fm-sections.md', `---
description: x
---
${VALID_AGENTS}`);
    const result = checkAgentsFile(filePath);
    expect(result.errors).toEqual([]);
  });

  it('populates hookSuggestions from the Verification section', () => {
    const filePath = writeAgents('hooks.md', VALID_AGENTS);
    const result = checkAgentsFile(filePath);
    expect(result.hookSuggestions).toBeDefined();
    expect(result.hookSuggestions?.map((s) => s.command)).toContain('npm test');
  });

  it('returns no hookSuggestions when the file has no Verification section', () => {
    const filePath = writeAgents('no-verify.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- Test: \`npm test\`

## Boundaries
- Never commit secrets
`);
    const result = checkAgentsFile(filePath);
    expect(result.hookSuggestions).toEqual([]);
  });
});

describe('checkClaudeFile', () => {
  it('fails if file does not exist', () => {
    const result = checkClaudeFile('./nonexistent.md', 'AGENTS.md');
    expect(result.passed).toBe(false);
  });

  it('warns if AGENTS.md not referenced', () => {
    const filePath = writeAgents('claude.md', 'Just follow the rules.');
    const result = checkClaudeFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('AGENTS.md'))).toBe(true);
  });

  it('passes when referencing AGENTS.md', () => {
    const filePath = writeAgents('claude.md', 'Follow AGENTS.md exactly.');
    const result = checkClaudeFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on cross-file contradiction', () => {
    const agentsPath = writeAgents('AGENTS.md', `# AGENTS.md

## Logging
- Always log request details
`);
    const claudePath = writeAgents('CLAUDE.md', `Follow AGENTS.md exactly.

## Logging
- Never log request details
`);
    const result = checkClaudeFile(claudePath, agentsPath);
    expect(result.warnings.some((w) => w.includes('contradict'))).toBe(true);
  });

  it('no contradiction warning when sections are consistent', () => {
    const agentsPath = writeAgents('AGENTS.md', `# AGENTS.md

## Safety rules
- Never log secrets
`);
    const claudePath = writeAgents('CLAUDE.md', `Follow AGENTS.md exactly.

## Safety rules
- Never expose credentials
`);
    const result = checkClaudeFile(claudePath, agentsPath);
    expect(result.warnings.some((w) => w.includes('contradict'))).toBe(false);
  });
});

describe('checkGeminiFile', () => {
  it('fails if file does not exist', () => {
    const result = checkGeminiFile('./nonexistent.md', 'AGENTS.md');
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('File not found');
  });

  it('passes with valid content referencing AGENTS.md', () => {
    const filePath = writeAgents('GEMINI.md', 'Follow AGENTS.md exactly.');
    const result = checkGeminiFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns if AGENTS.md not referenced (with GEMINI.md label)', () => {
    const filePath = writeAgents('GEMINI.md', 'Just follow the rules.');
    const result = checkGeminiFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('GEMINI.md') && w.includes('AGENTS.md'))).toBe(true);
  });

  it('detects contradiction with AGENTS.md', () => {
    const agentsPath = writeAgents('AGENTS.md', `# AGENTS.md

## Logging
- Always log request details
`);
    const geminiPath = writeAgents('GEMINI.md', `Follow AGENTS.md exactly.

## Logging
- Never log request details
`);
    const result = checkGeminiFile(geminiPath, agentsPath);
    expect(result.warnings.some((w) => w.includes('contradict'))).toBe(true);
  });
});

describe('checkCrossFileConsistency', () => {
  it('passes when no issues across present files', () => {
    const agentsPath = writeAgents('AGENTS.md', VALID_AGENTS);
    const claudePath = writeAgents('CLAUDE.md', 'Follow AGENTS.md exactly.');
    const geminiPath = writeAgents('GEMINI.md', 'Follow AGENTS.md exactly.');
    const result = checkCrossFileConsistency(agentsPath, claudePath, geminiPath);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects contradictions across three files', () => {
    const agentsPath = writeAgents('AGENTS.md', `# AGENTS.md

## Logging
- Always log request details
`);
    const claudePath = writeAgents('CLAUDE.md', 'Follow AGENTS.md exactly.');
    const geminiPath = writeAgents('GEMINI.md', `Follow AGENTS.md exactly.

## Logging
- Never log request details
`);
    const result = checkCrossFileConsistency(agentsPath, claudePath, geminiPath);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.type === 'contradiction')).toBe(true);
  });

  it('detects verbatim section duplication (CLAUDE.md == GEMINI.md)', () => {
    const agentsPath = writeAgents('AGENTS.md', VALID_AGENTS);
    const dup = `Follow AGENTS.md exactly.

## Extra notes
- Be careful here
- And here
`;
    const claudePath = writeAgents('CLAUDE.md', dup);
    const geminiPath = writeAgents('GEMINI.md', dup);
    const result = checkCrossFileConsistency(agentsPath, claudePath, geminiPath);
    expect(result.issues.some((i) => i.type === 'duplication')).toBe(true);
  });

  it('ignores files that do not exist', () => {
    const agentsPath = writeAgents('AGENTS.md', VALID_AGENTS);
    const claudePath = writeAgents('CLAUDE.md', 'Follow AGENTS.md exactly.');
    const result = checkCrossFileConsistency(agentsPath, claudePath, './does-not-exist-gemini.md');
    expect(result.passed).toBe(true);
  });
});
