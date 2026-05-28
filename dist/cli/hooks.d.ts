import type { HookSuggestion } from './types.js';
/**
 * Parse the Verification section of an AGENTS.md content string and return
 * suggested Claude Code hooks. Each recognized verification command becomes a
 * Stop-hook suggestion. Duplicate commands are de-duplicated.
 */
export declare function suggestHooks(content: string): HookSuggestion[];
/**
 * Render the suggested hooks as a `.claude/settings.json` snippet so users can
 * copy it directly. Returns null when there are no suggestions. All matching
 * commands are combined into a single Stop hook (chained with `&&`) since
 * Claude Code runs one command per hook entry.
 */
export declare function renderHookSettings(suggestions: HookSuggestion[]): string | null;
