import { describe, it, expect } from 'vitest';
import {
  computeScore,
  estimateTokens,
  computeTokenBudget,
  generateBadge,
  generateBadgeMarkdown,
  generateBadgeSvg,
  badgeUrl,
} from './score.js';
import type { CheckResult, CrossFileConsistencyResult, SafetyResult } from './types.js';

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return { passed: true, errors: [], warnings: [], ...overrides };
}

function makeSafety(overrides: Partial<SafetyResult> = {}): SafetyResult {
  return { passed: true, findings: [], ...overrides };
}

function makeConsistency(overrides: Partial<CrossFileConsistencyResult> = {}): CrossFileConsistencyResult {
  return { passed: true, issues: [], ...overrides };
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

  it('omits tokenBudget when no source text is provided', () => {
    const result = computeScore(makeCheck(), makeCheck(), makeSafety());
    expect(result.tokenBudget).toBeUndefined();
  });

  it('includes tokenBudget when source text is provided', () => {
    const result = computeScore(makeCheck(), makeCheck(), makeSafety(), 'x'.repeat(4000));
    expect(result.tokenBudget).toBeDefined();
    expect(result.tokenBudget).toHaveProperty('estimatedTokens');
    expect(result.tokenBudget).toHaveProperty('percentOfWindow');
    expect(result.tokenBudget).toHaveProperty('isWarning');
    expect(result.tokenBudget?.estimatedTokens).toBe(1000);
  });

  it('adds a suggestion when token budget exceeds the warning threshold', () => {
    // 24000 chars -> 6000 tokens -> 6% of 100k window (over the 5% threshold)
    const result = computeScore(makeCheck(), makeCheck(), makeSafety(), 'x'.repeat(24_000));
    expect(result.tokenBudget?.isWarning).toBe(true);
    expect(result.suggestions.some((s) => s.includes('context window'))).toBe(true);
  });

  it('does not warn for small files under the threshold', () => {
    const result = computeScore(makeCheck(), makeCheck(), makeSafety(), 'x'.repeat(4000));
    expect(result.tokenBudget?.isWarning).toBe(false);
    expect(result.suggestions.some((s) => s.includes('context window'))).toBe(false);
  });

  it('handles geminiCheck=null for backwards compatibility', () => {
    const result = computeScore(makeCheck(), makeCheck(), makeSafety(), undefined, null, null);
    expect(result.grade).toBe('A');
    expect(result.score).toBe(100);
  });

  it('penalizes GEMINI.md errors in the consistency category', () => {
    const gemini = makeCheck({ passed: false, errors: ['File is empty: GEMINI.md'] });
    const result = computeScore(makeCheck(), makeCheck(), makeSafety(), undefined, gemini, null);
    expect(result.breakdown['Consistency']).toBeLessThan(20);
    expect(result.suggestions.some((s) => s.includes('GEMINI.md'))).toBe(true);
  });

  it('penalizes GEMINI.md warnings (missing AGENTS.md reference)', () => {
    const gemini = makeCheck({ warnings: ['GEMINI.md should reference AGENTS.md as source of truth'] });
    const result = computeScore(makeCheck(), makeCheck(), makeSafety(), undefined, gemini, null);
    expect(result.breakdown['Consistency']).toBeLessThan(20);
    expect(result.suggestions.some((s) => s.includes('GEMINI.md should reference'))).toBe(true);
  });

  it('applies consistency penalties for cross-file issues', () => {
    const consistency = makeConsistency({
      passed: false,
      issues: [
        { type: 'contradiction', files: ['AGENTS.md', 'GEMINI.md'], message: 'x', severity: 'warn' },
        { type: 'duplication', files: ['CLAUDE.md', 'GEMINI.md'], message: 'y', severity: 'warn' },
      ],
    });
    const result = computeScore(makeCheck(), makeCheck(), makeSafety(), undefined, null, consistency);
    expect(result.breakdown['Consistency']).toBeLessThan(20);
    expect(result.suggestions.some((s) => s.includes('cross-file'))).toBe(true);
    expect(result.suggestions.some((s) => s.includes('duplicated'))).toBe(true);
  });

  it('drops grade when GEMINI.md and cross-file issues compound', () => {
    const clean = computeScore(makeCheck(), makeCheck(), makeSafety());
    const gemini = makeCheck({
      passed: false,
      errors: ['File not found: GEMINI.md'],
      warnings: [],
    });
    const consistency = makeConsistency({
      passed: false,
      issues: [
        { type: 'contradiction', files: ['AGENTS.md', 'GEMINI.md'], message: 'x', severity: 'warn' },
      ],
    });
    const degraded = computeScore(makeCheck(), makeCheck(), makeSafety(), undefined, gemini, consistency);
    expect(degraded.score).toBeLessThan(clean.score);
  });
});

describe('estimateTokens', () => {
  it('converts 4000 chars to 1000 tokens', () => {
    expect(estimateTokens('a'.repeat(4000))).toBe(1000);
  });

  it('returns 0 tokens for empty input', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('rounds up partial tokens', () => {
    expect(estimateTokens('abcde')).toBe(2); // 5 / 4 -> ceil -> 2
  });
});

describe('computeTokenBudget', () => {
  it('computes percentage of the 100k context window', () => {
    // 20000 chars -> 5000 tokens -> 5% of 100k window
    const budget = computeTokenBudget('a'.repeat(20_000));
    expect(budget.estimatedTokens).toBe(5000);
    expect(budget.percentOfWindow).toBeCloseTo(5, 5);
  });

  it('marks files exactly at the 5% threshold (5000 tokens) as a warning', () => {
    const budget = computeTokenBudget('a'.repeat(20_000));
    expect(budget.isWarning).toBe(true);
  });

  it('does not warn just below the threshold', () => {
    // 19996 chars -> 4999 tokens -> 4.999%
    const budget = computeTokenBudget('a'.repeat(19_996));
    expect(budget.isWarning).toBe(false);
  });

  it('returns 0 tokens and no warning for empty input', () => {
    const budget = computeTokenBudget('');
    expect(budget.estimatedTokens).toBe(0);
    expect(budget.percentOfWindow).toBe(0);
    expect(budget.isWarning).toBe(false);
  });
});

describe('badge generation', () => {
  const colorByGrade: Record<string, string> = {
    A: 'brightgreen',
    B: 'green',
    C: 'yellow',
    D: 'orange',
    F: 'red',
  };

  it('maps each grade to the correct shields.io color in the URL', () => {
    for (const [grade, color] of Object.entries(colorByGrade)) {
      expect(badgeUrl(grade)).toBe(
        `https://img.shields.io/badge/agent--instructions-${grade}-${color}`,
      );
    }
  });

  it('preserves the literal hyphen in the label via doubled dashes', () => {
    expect(badgeUrl('A')).toContain('agent--instructions');
    expect(badgeUrl('A')).not.toContain('agent_instructions');
  });

  it('generates markdown with alt text and the badge URL for each grade', () => {
    for (const grade of Object.keys(colorByGrade)) {
      const md = generateBadgeMarkdown(grade);
      expect(md).toBe(`![Agent Instructions Score: ${grade}](${badgeUrl(grade)})`);
    }
  });

  it('generateBadge defaults to markdown', () => {
    expect(generateBadge('A')).toBe(generateBadgeMarkdown('A'));
  });

  it('generateBadge returns SVG when format is svg', () => {
    expect(generateBadge('A', 'svg')).toBe(generateBadgeSvg('A'));
  });

  it('produces valid, self-contained SVG markup', () => {
    const svg = generateBadgeSvg('A');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('agent-instructions');
    expect(svg).toContain('>A<');
    // No network reference embedded.
    expect(svg).not.toContain('http://img.shields.io');
    expect(svg).not.toContain('https://img.shields.io');
  });

  it('uses an unknown-grade fallback color without throwing', () => {
    expect(badgeUrl('Z')).toContain('-lightgrey');
    expect(() => generateBadgeSvg('Z')).not.toThrow();
  });
});
