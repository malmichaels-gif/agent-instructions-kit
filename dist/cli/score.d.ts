import type { BadgeFormat, CheckResult, CrossFileConsistencyResult, SafetyResult, TokenBudgetInfo } from './types.js';
export interface ScoreResult {
    score: number;
    grade: string;
    breakdown: Record<string, number>;
    suggestions: string[];
    tokenBudget?: TokenBudgetInfo;
}
export declare function estimateTokens(text: string): number;
export declare function computeTokenBudget(text: string): TokenBudgetInfo;
export declare function computeScore(agentsCheck: CheckResult, claudeCheck: CheckResult, safetyResult: SafetyResult, sourceText?: string, geminiCheck?: CheckResult | null, consistencyResult?: CrossFileConsistencyResult | null): ScoreResult;
export declare function badgeUrl(grade: string): string;
export declare function generateBadgeMarkdown(grade: string): string;
export declare function generateBadgeSvg(grade: string): string;
export declare function generateBadge(grade: string, format?: BadgeFormat): string;
