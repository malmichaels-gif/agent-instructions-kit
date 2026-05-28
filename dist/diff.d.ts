import type { ParsedDiffRange } from './types.js';
export interface DiffParseResult {
    ranges: ParsedDiffRange[];
    error?: string;
}
export declare function parseDiff(diffText: string): DiffParseResult;
export declare function changedLinesForFile(ranges: ParsedDiffRange[], filePath: string): Set<number>;
export declare function getGitDiff(cwd?: string, runner?: (args: string[], cwd: string) => string): DiffParseResult;
