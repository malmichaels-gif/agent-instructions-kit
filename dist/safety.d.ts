import type { SafetyRule, SafetyResult, AIKSafetyConfig } from './types.js';
export declare function runSafetyCheck(path: string, ignorePath?: string, changedLines?: Set<number>, config?: AIKSafetyConfig): SafetyResult;
export declare function getSafetyRules(): SafetyRule[];
