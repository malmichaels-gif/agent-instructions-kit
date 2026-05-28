import type { CheckResult, CheckAgentsOptions, CrossFileConsistencyResult } from './types.js';
export declare function checkAgentsFile(filePath: string, options?: CheckAgentsOptions): CheckResult;
export declare function checkClaudeFile(filePath: string, agentsPath: string): CheckResult;
export declare function checkGeminiFile(filePath: string, agentsPath: string): CheckResult;
export declare function checkCrossFileConsistency(agentsPath: string, claudePath: string, geminiPath: string): CrossFileConsistencyResult;
