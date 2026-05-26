import type { CheckResult, SafetyResult } from './types.js';
export interface ScoreResult {
    score: number;
    grade: string;
    breakdown: Record<string, number>;
    suggestions: string[];
}
export declare function computeScore(agentsCheck: CheckResult, claudeCheck: CheckResult, safetyResult: SafetyResult): ScoreResult;
