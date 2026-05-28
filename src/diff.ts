import { execFileSync } from 'child_process';
import type { ParsedDiffRange } from './types.js';

// Internal result of parsing `git diff` output into changed-line ranges.
export interface DiffParseResult {
  ranges: ParsedDiffRange[];
  error?: string;
}

// Parses unified `git diff` output and extracts the set of *added/changed*
// lines per file, expressed as inclusive [startLine, endLine] ranges keyed by
// the post-image (new) file path. Only added lines (`+`) advance the new-file
// line counter and are recorded as changed; removed lines (`-`) and context
// lines are tracked for positioning but removals are not reported (they no
// longer exist in the file we are scanning).
//
// Diff-aware safety filters findings to lines that appear here, so we
// deliberately track the *new* file's line numbers — those match the line
// numbers `runSafetyCheck` reports when scanning the working-tree file.
//
// This is a simple line-oriented parser of standard unified diff output
// (lines starting with `diff --git`, `+++`, `@@`, `+`, `-`). It intentionally
// does not attempt to fully model renames, merges, or binary files — those are
// parsed loosely and contribute no changed lines, which is the safe default
// (fewer findings suppressed incorrectly is preferable to crashing).
export function parseDiff(diffText: string): DiffParseResult {
  const ranges: ParsedDiffRange[] = [];
  const lines = diffText.split('\n');

  let currentFile: string | null = null;
  // Line number in the new (post-image) file for the next non-removed line.
  let newLineNo = 0;
  // Accumulator for a contiguous run of changed lines so we emit compact ranges
  // instead of one range per line.
  let runStart = 0;
  let runEnd = 0;

  const flushRun = (): void => {
    if (currentFile !== null && runStart > 0) {
      ranges.push({ file: currentFile, startLine: runStart, endLine: runEnd });
    }
    runStart = 0;
    runEnd = 0;
  };

  for (const raw of lines) {
    // New file section. `+++ b/path` carries the post-image path; prefer it,
    // but fall back to the `diff --git a/x b/y` header.
    if (raw.startsWith('+++ ')) {
      flushRun();
      const p = raw.slice(4).trim();
      if (p === '/dev/null') {
        // File was deleted — nothing in the new tree to scan.
        currentFile = null;
      } else {
        currentFile = stripDiffPathPrefix(p);
      }
      continue;
    }

    if (raw.startsWith('--- ')) {
      // Pre-image header; ignored for new-file line tracking.
      continue;
    }

    if (raw.startsWith('diff --git')) {
      flushRun();
      // Defer the authoritative path to the following `+++` line, but record a
      // best-effort path so single-file diffs without `+++` still attribute.
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(raw);
      currentFile = m ? m[2] : null;
      continue;
    }

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (raw.startsWith('@@')) {
      flushRun();
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (m) {
        newLineNo = Number.parseInt(m[1], 10);
      }
      continue;
    }

    if (currentFile === null) continue;

    if (raw.startsWith('+')) {
      // Added/changed line in the new file.
      if (runStart === 0) {
        runStart = newLineNo;
      }
      runEnd = newLineNo;
      newLineNo++;
    } else if (raw.startsWith('-')) {
      // Removed line — exists only in the old file; does not advance newLineNo
      // and breaks any contiguous added run.
      flushRun();
    } else if (raw.startsWith('\\')) {
      // "\ No newline at end of file" — metadata, not a content line.
      continue;
    } else {
      // Context line (leading space) or blank line within a hunk: advances the
      // new-file counter and ends the current changed run.
      flushRun();
      newLineNo++;
    }
  }

  flushRun();
  return { ranges };
}

// Strips the leading `a/` or `b/` prefix git adds to diff paths.
function stripDiffPathPrefix(p: string): string {
  if (p.startsWith('a/') || p.startsWith('b/')) return p.slice(2);
  return p;
}

// Collapses parsed ranges for a single file into a flat set of changed line
// numbers, for O(1) membership checks during finding filtering.
export function changedLinesForFile(ranges: ParsedDiffRange[], filePath: string): Set<number> {
  const normalized = normalizePath(filePath);
  const result = new Set<number>();
  for (const r of ranges) {
    if (normalizePath(r.file) === normalized) {
      for (let n = r.startLine; n <= r.endLine; n++) {
        result.add(n);
      }
    }
  }
  return result;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

// Runs `git diff` (and `git diff --cached`) in `cwd` and returns the combined
// unified diff text. Returns an error string (not a throw) when git is missing
// or the directory is not a git repository, so callers can degrade gracefully.
// `runner` is injectable for tests.
export function getGitDiff(
  cwd = '.',
  runner: (args: string[], cwd: string) => string = defaultGitRunner,
): DiffParseResult {
  try {
    const againstHead = runner(['diff', '--no-color', '--unified=0', 'HEAD'], cwd);
    return parseDiff(againstHead);
  } catch (err) {
    // `HEAD` may not exist (no commits yet) — fall back to the working-tree
    // diff plus the staged diff, and surface a clear error only if both fail.
    try {
      const unstaged = runner(['diff', '--no-color', '--unified=0'], cwd);
      const staged = runner(['diff', '--no-color', '--unified=0', '--cached'], cwd);
      const combined = staged ? `${unstaged}\n${staged}` : unstaged;
      return parseDiff(combined);
    } catch (err2) {
      return { ranges: [], error: gitErrorMessage(err2 ?? err) };
    }
  }
}

function defaultGitRunner(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function gitErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e && e.code === 'ENOENT') {
    return 'git executable not found — diff mode requires git on PATH';
  }
  return 'could not read git diff — not a git repository or git failed';
}
