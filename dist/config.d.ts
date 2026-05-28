import type { AIKConfigResult, CustomSafetyRule } from './types.js';
export declare function compileCustomPattern(rule: CustomSafetyRule, warnings: string[]): RegExp | null;
export declare function loadConfig(configPath?: string): AIKConfigResult;
