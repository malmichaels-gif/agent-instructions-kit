import { describe, it, expect } from 'vitest';
import { suggestHooks, renderHookSettings } from './hooks.js';

const withVerification = (body: string): string => `# AGENTS.md

## Mission
Do stuff.

## Verification
${body}

## Boundaries
- Never commit secrets
`;

describe('suggestHooks', () => {
  it('suggests a Stop hook for `npm test` in the Verification section', () => {
    const suggestions = suggestHooks(withVerification('- `npm test` exits 0'));
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].hookType).toBe('Stop');
    expect(suggestions[0].command).toBe('npm test');
  });

  it('suggests a Stop hook for `npm run build`', () => {
    const suggestions = suggestHooks(withVerification('- `npm run build` exits 0'));
    expect(suggestions.map((s) => s.command)).toEqual(['npm run build']);
  });

  it('parses multiple commands separately and de-duplicates', () => {
    const body = [
      '- `npm run typecheck` exits 0',
      '- `npm run lint` exits 0',
      '- `npm test` exits 0',
      '- `npm test` again',
    ].join('\n');
    const suggestions = suggestHooks(withVerification(body));
    expect(suggestions.map((s) => s.command)).toEqual([
      'npm run typecheck',
      'npm run lint',
      'npm test',
    ]);
  });

  it('returns an empty array when there is no Verification section', () => {
    const content = `# AGENTS.md\n\n## Mission\nDo stuff.\n`;
    expect(suggestHooks(content)).toEqual([]);
  });

  it('skips non-command prose lines in the Verification section', () => {
    const body = [
      'Make sure everything works before you finish.',
      'Read the docs at https://example.com first.',
    ].join('\n');
    expect(suggestHooks(withVerification(body))).toEqual([]);
  });

  it('ignores backtick commands that are not recognized tools', () => {
    const body = '- `git push --force` is forbidden\n- `frobnicate the widget`';
    expect(suggestHooks(withVerification(body))).toEqual([]);
  });

  it('does not pick up commands outside the Verification section', () => {
    const content = `# AGENTS.md

## Mission
Run \`npm test\` somewhere in prose.

## Local dev commands
- Test: \`npm test\`

## Notes
Nothing to verify here.
`;
    expect(suggestHooks(content)).toEqual([]);
  });

  it('recognizes cargo, go, and pytest commands', () => {
    const cargo = suggestHooks(withVerification('- `cargo test --release` exits 0'));
    expect(cargo.map((s) => s.command)).toEqual(['cargo test --release']);

    const go = suggestHooks(withVerification('- `go test ./...` exits 0'));
    expect(go.map((s) => s.command)).toEqual(['go test ./...']);

    const py = suggestHooks(withVerification('- `pytest` exits 0'));
    expect(py.map((s) => s.command)).toEqual(['pytest']);
  });

  it('rejects a bare tool name with no action (e.g. just `npm`)', () => {
    expect(suggestHooks(withVerification('- run `npm`'))).toEqual([]);
  });

  it('matches a Testing heading as the verification section', () => {
    const content = `# AGENTS.md

## Mission
Do stuff.

## Testing
- Run \`npm test\` before finishing
`;
    expect(suggestHooks(content).map((s) => s.command)).toEqual(['npm test']);
  });

  it('normalizes internal whitespace in commands', () => {
    const suggestions = suggestHooks(withVerification('- `npm   run    build`'));
    expect(suggestions.map((s) => s.command)).toEqual(['npm run build']);
  });
});

describe('renderHookSettings', () => {
  it('returns null when there are no suggestions', () => {
    expect(renderHookSettings([])).toBeNull();
  });

  it('chains multiple commands into a single Stop hook', () => {
    const suggestions = suggestHooks(
      withVerification('- `npm run lint` exits 0\n- `npm test` exits 0'),
    );
    const settings = renderHookSettings(suggestions);
    expect(settings).not.toBeNull();
    const parsed = JSON.parse(settings as string);
    expect(parsed.hooks.Stop[0].hooks[0].command).toBe('npm run lint && npm test');
    expect(parsed.hooks.Stop[0].hooks[0].type).toBe('command');
  });
});
