import type { SafetyRule, SafetyResult } from './types.js';
export declare function runSafetyCheck(path: string): SafetyResult;
export declare function getSafetyRules(): SafetyRule[];
