import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, compileCustomPattern } from './config.js';

const TEST_DIR = './test-fixtures-config';
const CONFIG_PATH = path.join(TEST_DIR, '.aikconfig.json');

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

function writeConfig(content: string): string {
  fs.writeFileSync(CONFIG_PATH, content);
  return CONFIG_PATH;
}

describe('loadConfig', () => {
  it('returns empty config with no warnings when file is absent', () => {
    const result = loadConfig(path.join(TEST_DIR, 'does-not-exist.json'));
    expect(result.config).toEqual({});
    expect(result.warnings).toHaveLength(0);
  });

  it('parses a valid config with all fields', () => {
    writeConfig(
      JSON.stringify({
        check: { lineWarnThreshold: 100, lineErrorThreshold: 250 },
        safety: {
          severityOverrides: { 'curl-bash': 'error', 'ambiguous-hedge': 'off' },
          ignoreRules: ['vague-persona'],
          customRules: [
            { id: 'no-foo', pattern: 'foobar', message: 'No foobar allowed', severity: 'error' },
          ],
        },
      }),
    );
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(warnings).toHaveLength(0);
    expect(config.check?.lineWarnThreshold).toBe(100);
    expect(config.check?.lineErrorThreshold).toBe(250);
    expect(config.safety?.severityOverrides).toEqual({
      'curl-bash': 'error',
      'ambiguous-hedge': 'off',
    });
    expect(config.safety?.ignoreRules).toEqual(['vague-persona']);
    expect(config.safety?.customRules).toEqual([
      { id: 'no-foo', pattern: 'foobar', message: 'No foobar allowed', severity: 'error' },
    ]);
  });

  it('rejects invalid JSON with a helpful warning and falls back to defaults', () => {
    writeConfig('{ this is not json ]');
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(config).toEqual({});
    expect(warnings.some((w) => w.includes('not valid JSON'))).toBe(true);
  });

  it('warns when the root is not an object', () => {
    writeConfig('[1, 2, 3]');
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(config).toEqual({});
    expect(warnings.some((w) => w.includes('must contain a JSON object'))).toBe(true);
  });

  it('warns on unknown root keys (typos)', () => {
    writeConfig(JSON.stringify({ saftey: {}, chekc: {} }));
    const { warnings } = loadConfig(CONFIG_PATH);
    expect(warnings.some((w) => w.includes('Unknown config key "saftey"'))).toBe(true);
    expect(warnings.some((w) => w.includes('Unknown config key "chekc"'))).toBe(true);
  });

  it('warns on unknown nested keys', () => {
    writeConfig(JSON.stringify({ check: { lineWarn: 100 }, safety: { overrides: {} } }));
    const { warnings } = loadConfig(CONFIG_PATH);
    expect(warnings.some((w) => w.includes('check.lineWarn'))).toBe(true);
    expect(warnings.some((w) => w.includes('safety.overrides'))).toBe(true);
  });

  it('rejects invalid severity override values', () => {
    writeConfig(
      JSON.stringify({ safety: { severityOverrides: { 'curl-bash': 'critical' } } }),
    );
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(config.safety?.severityOverrides).toBeUndefined();
    expect(warnings.some((w) => w.includes('must be one of warn|error|off'))).toBe(true);
  });

  it('accepts all valid severity override values (warn|error|off)', () => {
    writeConfig(
      JSON.stringify({
        safety: { severityOverrides: { a: 'warn', b: 'error', c: 'off' } },
      }),
    );
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(warnings).toHaveLength(0);
    expect(config.safety?.severityOverrides).toEqual({ a: 'warn', b: 'error', c: 'off' });
  });

  it('warns and skips a custom rule with an invalid regex pattern', () => {
    writeConfig(
      JSON.stringify({
        safety: { customRules: [{ id: 'bad', pattern: '(', message: 'Unbalanced' }] },
      }),
    );
    // loadConfig keeps the rule string but compilation happens later; validate
    // via the compile helper that it is rejected with a warning.
    const { config } = loadConfig(CONFIG_PATH);
    const rule = config.safety?.customRules?.[0];
    expect(rule).toBeDefined();
    const warnings: string[] = [];
    const compiled = compileCustomPattern(rule!, warnings);
    expect(compiled).toBeNull();
    expect(warnings.some((w) => w.includes('invalid regex'))).toBe(true);
  });

  it('skips custom rules missing id/pattern/message', () => {
    writeConfig(
      JSON.stringify({
        safety: {
          customRules: [
            { pattern: 'x', message: 'no id' },
            { id: 'r2', message: 'no pattern' },
            { id: 'r3', pattern: 'y' },
            { id: 'good', pattern: 'z', message: 'ok' },
          ],
        },
      }),
    );
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(config.safety?.customRules).toHaveLength(1);
    expect(config.safety?.customRules?.[0].id).toBe('good');
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('defaults custom rule severity to warn when omitted', () => {
    writeConfig(
      JSON.stringify({ safety: { customRules: [{ id: 'r', pattern: 'x', message: 'm' }] } }),
    );
    const { config } = loadConfig(CONFIG_PATH);
    expect(config.safety?.customRules?.[0].severity).toBe('warn');
  });

  it('deduplicates custom rule ids, keeping the first', () => {
    writeConfig(
      JSON.stringify({
        safety: {
          customRules: [
            { id: 'dup', pattern: 'a', message: 'first' },
            { id: 'dup', pattern: 'b', message: 'second' },
          ],
        },
      }),
    );
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(config.safety?.customRules).toHaveLength(1);
    expect(config.safety?.customRules?.[0].message).toBe('first');
    expect(warnings.some((w) => w.includes('Duplicate custom rule id'))).toBe(true);
  });

  it('rejects non-positive / non-numeric line thresholds', () => {
    writeConfig(
      JSON.stringify({ check: { lineWarnThreshold: -5, lineErrorThreshold: 'big' } }),
    );
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(config.check?.lineWarnThreshold).toBeUndefined();
    expect(config.check?.lineErrorThreshold).toBeUndefined();
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('warns when warn threshold exceeds error threshold', () => {
    writeConfig(
      JSON.stringify({ check: { lineWarnThreshold: 400, lineErrorThreshold: 100 } }),
    );
    const { warnings } = loadConfig(CONFIG_PATH);
    expect(warnings.some((w) => w.includes('never trigger'))).toBe(true);
  });

  it('warns when top-level sections are the wrong type', () => {
    writeConfig(JSON.stringify({ check: 'nope', safety: 5 }));
    const { config, warnings } = loadConfig(CONFIG_PATH);
    expect(config.check).toBeUndefined();
    expect(config.safety).toBeUndefined();
    expect(warnings.some((w) => w.includes('"check" must be an object'))).toBe(true);
    expect(warnings.some((w) => w.includes('"safety" must be an object'))).toBe(true);
  });
});

describe('compileCustomPattern', () => {
  it('compiles a valid pattern case-insensitively', () => {
    const warnings: string[] = [];
    const re = compileCustomPattern({ id: 'r', pattern: 'hello', message: 'm' }, warnings);
    expect(re).not.toBeNull();
    expect(re!.test('HELLO world')).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('returns null for an empty pattern', () => {
    const warnings: string[] = [];
    const re = compileCustomPattern({ id: 'r', pattern: '', message: 'm' }, warnings);
    expect(re).toBeNull();
    expect(warnings).toHaveLength(1);
  });
});
