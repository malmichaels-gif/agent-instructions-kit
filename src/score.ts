import type { CheckResult, SafetyResult } from './types.js';

export interface ScoreResult {
  score: number;
  grade: string;
  breakdown: Record<string, number>;
  suggestions: string[];
}

const CLARITY_RULE_IDS = new Set(['ambiguous-hedge', 'vague-persona']);

export function computeScore(
  agentsCheck: CheckResult,
  claudeCheck: CheckResult,
  safetyResult: SafetyResult,
): ScoreResult {
  const breakdown: Record<string, number> = {};
  const suggestions: string[] = [];

  let structurePoints = 30;
  if (!agentsCheck.passed) {
    structurePoints -= agentsCheck.errors.length * 10;
    suggestions.push('Fix required section errors in AGENTS.md');
  }
  const qualityWarnings = agentsCheck.warnings.filter((w) =>
    w.includes('recommended section') || w.includes('boundary constraints') || w.includes('no executable commands'),
  );
  structurePoints -= qualityWarnings.length * 3;
  if (qualityWarnings.some((w) => w.includes('Verification'))) {
    suggestions.push('Add a Verification section with concrete exit criteria');
  }
  if (qualityWarnings.some((w) => w.includes('Boundaries'))) {
    suggestions.push('Add a Boundaries section with explicit limits');
  }
  if (qualityWarnings.some((w) => w.includes('no executable commands'))) {
    suggestions.push('Add verifiable commands (in backticks) to prose-only sections');
  }
  breakdown['Structure'] = Math.max(0, structurePoints);

  let safetyPoints = 30;
  const errors = safetyResult.findings.filter((f) => f.severity === 'error');
  const warns = safetyResult.findings.filter((f) => f.severity === 'warn' && !CLARITY_RULE_IDS.has(f.ruleId));
  safetyPoints -= errors.length * 10;
  safetyPoints -= warns.length * 3;
  if (errors.length > 0) suggestions.push(`Fix ${errors.length} safety error(s) — these indicate dangerous patterns`);
  if (warns.length > 0) suggestions.push(`Review ${warns.length} safety warning(s)`);
  breakdown['Safety'] = Math.max(0, safetyPoints);

  let clarityPoints = 20;
  const lengthWarning = agentsCheck.warnings.find((w) => w.includes('lines'));
  if (lengthWarning) {
    const isHardWarn = />\s*300\)/.test(lengthWarning);
    clarityPoints -= isHardWarn ? 10 : 5;
    suggestions.push('Trim instruction file — shorter files correlate with better agent performance');
  }
  const ambiguityFindings = safetyResult.findings.filter((f) => f.ruleId === 'ambiguous-hedge');
  clarityPoints -= ambiguityFindings.length * 2;
  if (ambiguityFindings.length > 0) {
    suggestions.push('Replace hedge words ("try to", "where possible") with concrete instructions');
  }
  const personaFindings = safetyResult.findings.filter((f) => f.ruleId === 'vague-persona');
  clarityPoints -= personaFindings.length * 3;
  breakdown['Clarity'] = Math.max(0, clarityPoints);

  let consistencyPoints = 20;
  if (!claudeCheck.passed) {
    consistencyPoints -= claudeCheck.errors.length * 10;
    suggestions.push('Fix errors in CLAUDE.md');
  }
  consistencyPoints -= claudeCheck.warnings.length * 5;
  if (claudeCheck.warnings.some((w) => w.includes('reference AGENTS.md'))) {
    suggestions.push('CLAUDE.md should reference AGENTS.md as source of truth');
  }
  if (claudeCheck.warnings.some((w) => w.includes('contradict'))) {
    suggestions.push('Resolve contradictions between CLAUDE.md and AGENTS.md');
  }
  breakdown['Consistency'] = Math.max(0, consistencyPoints);

  const score = Math.max(0, Math.min(100,
    breakdown['Structure'] + breakdown['Safety'] + breakdown['Clarity'] + breakdown['Consistency'],
  ));

  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return { score, grade, breakdown, suggestions };
}
