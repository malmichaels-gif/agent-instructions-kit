import type { Frontmatter } from './types.js';
export interface FrontmatterParseResult {
    success: boolean;
    data?: Frontmatter;
    error?: string;
}
export declare function hasFrontmatter(content: string): boolean;
export declare function stripFrontmatter(content: string): string;
export declare function parseFrontmatter(content: string): FrontmatterParseResult;
export declare function validateFrontmatter(data: Frontmatter): string[];
