import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  runFix,
  addMissingRequiredSections,
  redactSecrets,
  replaceHedgeWords,
  addAgentsReference,
} from './fix.js';

const TEST_DIR = './test-fixtures-fix';

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

describe('addMissingRequiredSections', () => {
  it('adds Mission and Local dev commands when absent', () => {
    const { content, actions } = addMissingRequiredSections('# AGENTS.md\n\n## Stack\nNode.\n', 'AGENTS.md');
    expect(content).toMatch(/^##\s+Mission/m);
    expect(content).toMatch(/^##\s+Local dev commands/m);
    expect(actions).toHaveLength(2);
    expect(actions.every((a) => a.type === 'add-section')).toBe(true);
  });

  it('does not add sections that already exist', () => {
    const input = '# AGENTS.md\n\n## Mission\nBuild.\n\n## Local dev commands\n- npm test\n';
    const { content, actions } = addMissingRequiredSections(input, 'AGENTS.md');
    expect(actions).toHaveLength(0);
    expect(content).toBe(input);
  });

  it('adds only the missing section', () => {
    const input = '# AGENTS.md\n\n## Mission\nBuild.\n';
    const { actions } = addMissingRequiredSections(input, 'AGENTS.md');
    expect(actions).toHaveLength(1);
    expect(actions[0].newValue).toMatch(/Local dev commands/);
  });
});

describe('redactSecrets', () => {
  it('redacts AWS access keys', () => {
    const { content, actions } = redactSecrets('Use key AKIAIOSFODNN7EXAMPLE here.', 'AGENTS.md');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(actions.some((a) => a.description.includes('leaked-aws-key'))).toBe(true);
  });

  it('redacts generic secrets but keeps the key prefix', () => {
    const { content, actions } = redactSecrets('api_key: "sk-1234567890abcdefghijklmnop"', 'AGENTS.md');
    expect(content).toContain('api_key');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('sk-1234567890abcdefghijklmnop');
    expect(actions).toHaveLength(1);
  });

  it('redacts private keys', () => {
    const { content } = redactSecrets('-----BEGIN RSA PRIVATE KEY-----', 'AGENTS.md');
    expect(content).toBe('[REDACTED]');
  });

  it('redacts JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const { content, actions } = redactSecrets(`Bearer ${jwt}`, 'AGENTS.md');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain(jwt);
    expect(actions).toHaveLength(1);
  });

  it('leaves clean content untouched', () => {
    const input = '## Mission\nBuild a great app.';
    const { content, actions } = redactSecrets(input, 'AGENTS.md');
    expect(content).toBe(input);
    expect(actions).toHaveLength(0);
  });
});

describe('replaceHedgeWords', () => {
  it('replaces "try to" with "do"', () => {
    const { content } = replaceHedgeWords('Try to keep functions small.', 'AGENTS.md');
    expect(content).toBe('do keep functions small.');
  });

  it('replaces "where possible" with "ensure"', () => {
    const { content } = replaceHedgeWords('Add tests where possible.', 'AGENTS.md');
    expect(content).toBe('Add tests ensure.');
  });

  it('replaces multiple hedge words and reports each', () => {
    const { content, actions } = replaceHedgeWords('Optionally refactor as needed.', 'AGENTS.md');
    expect(content).toBe('must refactor must.');
    expect(actions.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves clean content untouched', () => {
    const input = 'Run `npm test` before every commit.';
    const { content, actions } = replaceHedgeWords(input, 'AGENTS.md');
    expect(content).toBe(input);
    expect(actions).toHaveLength(0);
  });
});

describe('addAgentsReference', () => {
  it('prepends a reference when missing', () => {
    const { content, actions } = addAgentsReference('# CLAUDE.md\n\nSome notes.\n', 'CLAUDE.md');
    expect(content).toContain('AGENTS.md');
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('add-agents-reference');
  });

  it('does nothing when reference already present', () => {
    const input = 'Follow AGENTS.md exactly.\n';
    const { content, actions } = addAgentsReference(input, 'CLAUDE.md');
    expect(content).toBe(input);
    expect(actions).toHaveLength(0);
  });
});

describe('runFix', () => {
  function writeAgents(content: string): string {
    const p = path.join(TEST_DIR, 'AGENTS.md');
    fs.writeFileSync(p, content);
    return p;
  }
  function writeClaude(content: string): string {
    const p = path.join(TEST_DIR, 'CLAUDE.md');
    fs.writeFileSync(p, content);
    return p;
  }

  it('writes both files in normal mode', () => {
    const agentsPath = writeAgents('# AGENTS.md\n\n## Stack\nTry to use Node.\n');
    const claudePath = writeClaude('# CLAUDE.md\n\nNo reference here.\n');

    const report = runFix({ agentsPath, claudePath, dryRun: false });
    expect(report.dryRun).toBe(false);
    expect(report.applied.length).toBeGreaterThan(0);

    const agentsOut = fs.readFileSync(agentsPath, 'utf-8');
    expect(agentsOut).toMatch(/^##\s+Mission/m);
    expect(agentsOut).toMatch(/^##\s+Local dev commands/m);
    expect(agentsOut).toContain('do use Node.');

    const claudeOut = fs.readFileSync(claudePath, 'utf-8');
    expect(claudeOut).toContain('AGENTS.md');
  });

  it('dry-run does not write files but reports actions', () => {
    const original = '# AGENTS.md\n\n## Stack\nTry to use Node.\n';
    const agentsPath = writeAgents(original);
    const claudePath = path.join(TEST_DIR, 'CLAUDE.md');

    const report = runFix({ agentsPath, claudePath, dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.applied.length).toBeGreaterThan(0);
    expect(fs.readFileSync(agentsPath, 'utf-8')).toBe(original);
  });

  it('handles mixed safety and structure fixes in one run', () => {
    const agentsPath = writeAgents(
      '# AGENTS.md\n\n## Stack\nUse key AKIAIOSFODNN7EXAMPLE and try to be safe.\n'
    );
    const claudePath = path.join(TEST_DIR, 'CLAUDE.md');

    const report = runFix({ agentsPath, claudePath, dryRun: false });
    const types = new Set(report.applied.map((a) => a.type));
    expect(types.has('redact-secret')).toBe(true);
    expect(types.has('replace-hedge')).toBe(true);
    expect(types.has('add-section')).toBe(true);

    const out = fs.readFileSync(agentsPath, 'utf-8');
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('reports no actions for a clean, complete file', () => {
    const agentsPath = writeAgents(
      '# AGENTS.md\n\n## Mission\nBuild.\n\n## Local dev commands\n- `npm test`\n'
    );
    const claudePath = writeClaude('Follow AGENTS.md exactly.\n');

    const report = runFix({ agentsPath, claudePath, dryRun: false });
    expect(report.applied).toHaveLength(0);
  });

  it('gracefully skips missing files', () => {
    const report = runFix({
      agentsPath: path.join(TEST_DIR, 'nope-AGENTS.md'),
      claudePath: path.join(TEST_DIR, 'nope-CLAUDE.md'),
      dryRun: false,
    });
    expect(report.passed).toBe(true);
    expect(report.applied).toHaveLength(0);
  });
});
