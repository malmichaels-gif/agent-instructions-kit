import { describe, it, expect } from 'vitest';
import { computeScore } from './score.js';
import type { CheckResult, SafetyResult } from './types.js';

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return { passed: true, errors: [], warnings: [], ...overrides };
}

function makeSafety(overrides: Partial<SafetyResult> = {}): SafetyResult {
  return { passed: true, findings: [], ...overrides };
}

describe('computeScore', () => {
  it('gives A grade for perfect files', () => {
    const result = computeScore(makeCheck(), makeCheck(), makeSafety());
    expect(result.grade).toBe('A');
    expect(result.score).toBe(100);
    expect(result.suggestions).toHaveLength(0);
  });

  it('penalizes missing required sections', () => {
    const agents = makeCheck({
      passed: false,
      errors: ['Missing required section: "Mission"', 'Missing required section: "Local dev commands"'],
    });
    const result = computeScore(agents, makeCheck(), makeSafety());
    expect(result.score).toBeLessThan(90);
    expect(result.suggestions.some((s) => s.includes('required section'))).toBe(true);
  });

  it('penalizes safety errors heavily', () => {
    const safety = makeSafety({
      passed: false,
      findings: [
        { ruleId: 'ignore-instructions', message: 'test', line: 1, severity: 'error' },
        { ruleId: 'print-secrets', message: 'test', line: 2, severity: 'error' },
        { ruleId: 'upload-repo', message: 'test', line: 3, severity: 'error' },
      ],
    });
    const result = computeScore(makeCheck(), makeCheck(), safety);
    expect(result.score).toBeLessThanOrEqual(70);
    expect(result.suggestions.some((s) => s.includes('safety error'))).toBe(true);
  });

  it('penalizes ambiguous language', () => {
    const safety = makeSafety({
      passed: true,
      findings: [
        { ruleId: 'ambiguous-hedge', message: 'test', line: 1, severity: 'warn' },
        { ruleId: 'ambiguous-hedge', message: 'test', line: 5, severity: 'warn' },
        { ruleId: 'ambiguous-hedge', message: 'test', line: 9, severity: 'warn' },
      ],
    });
    const result = computeScore(makeCheck(), makeCheck(), safety);
    expect(result.breakdown['Clarity']).toBeLessThan(20);
  });

  it('penalizes CLAUDE.md inconsistencies', () => {
    const claude = makeCheck({
      warnings: ['Section "Safety rules" may contradict AGENTS.md — review for consistency'],
    });
    const result = computeScore(makeCheck(), claude, makeSafety());
    expect(result.breakdown['Consistency']).toBeLessThan(20);
  });

  it('gives F for catastrophic files', () => {
    const agents = makeCheck({
      passed: false,
      errors: ['Missing required section: "Mission"', 'Missing required section: "Local dev commands"'],
      warnings: ['File is 400 lines (>300). Agent performance degrades'],
    });
    const safety = makeSafety({
      passed: false,
      findings: [
        { ruleId: 'ignore-instructions', message: 'test', line: 1, severity: 'error' },
        { ruleId: 'print-secrets', message: 'test', line: 2, severity: 'error' },
        { ruleId: 'upload-repo', message: 'test', line: 3, severity: 'error' },
      ],
    });
    const claude = makeCheck({
      passed: false,
      errors: ['File not found: CLAUDE.md'],
    });
    const result = computeScore(agents, claude, safety);
    expect(result.grade).toBe('F');
  });

  it('returns breakdown with all categories', () => {
    const result = computeScore(makeCheck(), makeCheck(), makeSafety());
    expect(result.breakdown).toHaveProperty('Structure');
    expect(result.breakdown).toHaveProperty('Safety');
    expect(result.breakdown).toHaveProperty('Clarity');
    expect(result.breakdown).toHaveProperty('Consistency');
  });
});
