import * as fs from 'fs';
import * as path from 'path';
import { checkAgentsFile, checkClaudeFile, checkGeminiFile, checkCrossFileConsistency } from './check.js';
import { runSafetyCheck } from './safety.js';
import { computeScore } from './score.js';
import { discoverAgentsFiles } from './discover.js';
import type { WatchConfig } from './types.js';

// Internal result shape for a single watch re-score event.
export interface WatchResult {
  score: number;
  grade: string;
  timestamp: Date;
}

// Re-runs the full scoring pipeline for the watched files. Mirrors the `score`
// command so the grade printed in watch mode matches `score` exactly.
export function computeWatchScore(config: WatchConfig): WatchResult {
  const { agentsPath, claudePath } = config;
  const geminiPath = 'GEMINI.md';

  const agentsFileCount = discoverAgentsFiles('.').length;
  const agentsResult = checkAgentsFile(agentsPath, { agentsFileCount });
  const claudeResult = checkClaudeFile(claudePath, agentsPath);
  const geminiResult = fs.existsSync(geminiPath) ? checkGeminiFile(geminiPath, agentsPath) : null;
  const consistencyResult = checkCrossFileConsistency(agentsPath, claudePath, geminiPath);
  const safetyResult = runSafetyCheck(agentsPath);

  let sourceText = '';
  if (fs.existsSync(agentsPath)) sourceText += fs.readFileSync(agentsPath, 'utf8');
  if (fs.existsSync(claudePath)) sourceText += fs.readFileSync(claudePath, 'utf8');
  if (fs.existsSync(geminiPath)) sourceText += fs.readFileSync(geminiPath, 'utf8');

  const result = computeScore(
    agentsResult,
    claudeResult,
    safetyResult,
    sourceText,
    geminiResult,
    consistencyResult,
  );

  return { score: result.score, grade: result.grade, timestamp: new Date() };
}

// A function the watcher invokes after debouncing. Exposed for testing.
export type RescoreCallback = (changedPath: string) => void;

// Dependencies the watcher needs from the host environment. Injectable so unit
// tests can drive the debounce/watch logic without touching the real fs.watch
// or global timers.
export interface WatchDeps {
  watch?: typeof fs.watch;
  existsSync?: (p: string) => boolean;
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
}

export interface WatchHandle {
  // Stops all watchers and clears any pending debounce timer.
  close: () => void;
}

// Watches the configured instruction files and invokes `onRescore` after each
// change, debounced by `config.debounceMs`. Rapid saves within the debounce
// window collapse into a single callback. Returns a handle to stop watching.
//
// fs.watch is platform-dependent (e.g. Windows may emit `rename` rather than
// `change`), so we react to ALL events and rely on the debounce + existence
// check to settle. Files that don't yet exist are skipped (no watcher created).
export function watchAgentsFile(
  config: WatchConfig,
  onRescore: RescoreCallback,
  deps: WatchDeps = {},
): WatchHandle {
  const watchFn = deps.watch ?? fs.watch;
  const exists = deps.existsSync ?? fs.existsSync;
  const setT = deps.setTimeout ?? setTimeout;
  const clearT = deps.clearTimeout ?? clearTimeout;

  // De-duplicate paths (agents and claude could be the same file) and only
  // watch files that exist.
  const targets = Array.from(new Set([config.agentsPath, config.claudePath]));

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastChanged = '';
  let closed = false;

  const schedule = (changedPath: string): void => {
    if (closed) return;
    lastChanged = changedPath;
    if (timer !== null) clearT(timer);
    timer = setT(() => {
      timer = null;
      if (closed) return;
      onRescore(lastChanged);
    }, config.debounceMs);
  };

  const watchers: fs.FSWatcher[] = [];
  for (const target of targets) {
    if (!exists(target)) continue;
    try {
      const watcher = watchFn(target, () => schedule(target));
      // Surface watcher errors (e.g. file removed) without crashing the process.
      watcher.on('error', () => {
        /* ignore — file may have been removed; next save re-triggers via dir */
      });
      watchers.push(watcher);
    } catch {
      // Unable to watch this path (e.g. permissions); skip it.
    }
  }

  return {
    close: (): void => {
      closed = true;
      if (timer !== null) {
        clearT(timer);
        timer = null;
      }
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          // Ignore close errors.
        }
      }
    },
  };
}

// Formats a WatchResult for human-readable stdout in watch mode.
export function formatWatchResult(result: WatchResult, changedPath: string): string {
  const time = result.timestamp.toLocaleTimeString('en-US', { hour12: false });
  const file = path.basename(changedPath);
  return `[${time}] ${file} changed -> Grade: ${result.grade} (${result.score}/100)`;
}
