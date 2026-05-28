import type {
  BadgeFormat,
  CheckResult,
  CrossFileConsistencyResult,
  SafetyResult,
  TokenBudgetInfo,
} from './types.js';

export interface ScoreResult {
  score: number;
  grade: string;
  breakdown: Record<string, number>;
  suggestions: string[];
  tokenBudget?: TokenBudgetInfo;
}

const CLARITY_RULE_IDS = new Set(['ambiguous-hedge', 'vague-persona']);

// Rough heuristic: ~4 characters per token. Actual token counts vary by content
// (code is denser than prose), so this is an estimate, not an exact measure.
const CHARS_PER_TOKEN = 4;
// Typical context window used as the reference for budget percentages.
const CONTEXT_WINDOW_TOKENS = 100_000;
// Warn when instruction files consume more than this share of the window.
const WARNING_THRESHOLD_PERCENT = 5;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function computeTokenBudget(text: string): TokenBudgetInfo {
  const estimatedTokens = estimateTokens(text);
  const percentOfWindow = (estimatedTokens / CONTEXT_WINDOW_TOKENS) * 100;
  return {
    estimatedTokens,
    percentOfWindow,
    isWarning: percentOfWindow >= WARNING_THRESHOLD_PERCENT,
  };
}

export function computeScore(
  agentsCheck: CheckResult,
  claudeCheck: CheckResult,
  safetyResult: SafetyResult,
  sourceText?: string,
  geminiCheck?: CheckResult | null,
  consistencyResult?: CrossFileConsistencyResult | null,
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

  if (geminiCheck) {
    if (!geminiCheck.passed) {
      consistencyPoints -= geminiCheck.errors.length * 10;
      suggestions.push('Fix errors in GEMINI.md');
    }
    consistencyPoints -= geminiCheck.warnings.length * 5;
    if (geminiCheck.warnings.some((w) => w.includes('reference AGENTS.md'))) {
      suggestions.push('GEMINI.md should reference AGENTS.md as source of truth');
    }
    if (geminiCheck.warnings.some((w) => w.includes('contradict'))) {
      suggestions.push('Resolve contradictions between GEMINI.md and AGENTS.md');
    }
  }

  if (consistencyResult && consistencyResult.issues.length > 0) {
    consistencyPoints -= consistencyResult.issues.length * 3;
    if (consistencyResult.issues.some((i) => i.type === 'contradiction')) {
      suggestions.push('Resolve cross-file contradictions across AGENTS.md / CLAUDE.md / GEMINI.md');
    }
    if (consistencyResult.issues.some((i) => i.type === 'duplication')) {
      suggestions.push('Remove duplicated sections — keep shared content in AGENTS.md only');
    }
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

  const result: ScoreResult = { score, grade, breakdown, suggestions };

  if (sourceText !== undefined) {
    const tokenBudget = computeTokenBudget(sourceText);
    result.tokenBudget = tokenBudget;
    if (tokenBudget.isWarning) {
      suggestions.push(
        `Instruction files consume ~${tokenBudget.percentOfWindow.toFixed(1)}% of a ${formatWindowLabel()} context window — trim to free up tokens for the agent`,
      );
    }
  }

  return result;
}

function formatWindowLabel(): string {
  return `${CONTEXT_WINDOW_TOKENS / 1000}k`;
}

// shields.io color names keyed by grade. These are the standard named colors
// shields.io accepts directly in the badge URL.
const GRADE_COLORS: Record<string, string> = {
  A: 'brightgreen',
  B: 'green',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

function badgeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? 'lightgrey';
}

// Escapes a value for a shields.io static badge path segment. Per shields.io,
// literal dashes must be doubled and underscores/spaces have special meaning,
// so encode the label/grade conservatively.
function shieldsEscape(value: string): string {
  return value.replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_');
}

export function badgeUrl(grade: string): string {
  const label = shieldsEscape('agent-instructions');
  const message = shieldsEscape(grade);
  return `https://img.shields.io/badge/${label}-${message}-${badgeColor(grade)}`;
}

export function generateBadgeMarkdown(grade: string): string {
  return `![Agent Instructions Score: ${grade}](${badgeUrl(grade)})`;
}

// Renders a self-contained SVG badge equivalent to the shields.io "flat" style,
// so the badge can be committed/served without a network dependency.
export function generateBadgeSvg(grade: string): string {
  const label = 'agent-instructions';
  const message = grade;
  const color = SVG_COLORS[grade] ?? '#9f9f9f';
  // Approximate width: ~7px per char + padding. Keeps text from clipping.
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;
  const labelMid = labelWidth / 2;
  const messageMid = labelWidth + messageWidth / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">`,
    `<title>${label}: ${message}</title>`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${labelWidth}" height="20" fill="#555"/>`,
    `<rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>`,
    `<rect width="${totalWidth}" height="20" fill="url(#s)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${labelMid}" y="14">${label}</text>`,
    `<text x="${messageMid}" y="14">${message}</text>`,
    `</g>`,
    `</svg>`,
  ].join('');
}

// Hex equivalents of the shields.io named colors, used for self-contained SVGs.
const SVG_COLORS: Record<string, string> = {
  A: '#4c1',
  B: '#97ca00',
  C: '#dfb317',
  D: '#fe7d37',
  F: '#e05d44',
};

export function generateBadge(grade: string, format: BadgeFormat = 'markdown'): string {
  return format === 'svg' ? generateBadgeSvg(grade) : generateBadgeMarkdown(grade);
}
