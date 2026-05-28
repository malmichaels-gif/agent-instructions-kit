import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  watchAgentsFile,
  computeWatchScore,
  formatWatchResult,
  type WatchDeps,
} from './watch.js';
import type { WatchConfig } from './types.js';

const TEST_DIR = path.resolve('./test-fixtures-watch');

function writeFixture(name: string, content: string): string {
  const p = path.join(TEST_DIR, name);
  fs.writeFileSync(p, content);
  return p;
}

beforeEach(() => {
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  } catch {
    // ignore
  }
});

// A fake fs.watch that returns a controllable emitter so tests can fire change
// events deterministically without touching the real filesystem watcher.
class FakeWatcher extends EventEmitter {
  closed = false;
  callback: fs.WatchListener<string>;
  constructor(callback: fs.WatchListener<string>) {
    super();
    this.callback = callback;
  }
  fire(): void {
    this.callback('change', 'file');
  }
  close(): void {
    this.closed = true;
  }
}

describe('computeWatchScore', () => {
  it('returns a grade and score matching the score pipeline', () => {
    const agentsPath = writeFixture(
      'AGENTS.md',
      '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n## Verification\n- Run `npm test`\n\n## Boundaries\n- Never commit secrets\n',
    );
    const claudePath = writeFixture('CLAUDE.md', 'Follow AGENTS.md exactly.');
    const config: WatchConfig = { agentsPath, claudePath, debounceMs: 300 };
    const result = computeWatchScore(config);
    expect(typeof result.score).toBe('number');
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});

describe('watchAgentsFile debounce', () => {
  it('collapses rapid changes into a single re-score call', () => {
    vi.useFakeTimers();
    const agentsPath = writeFixture('AGENTS.md', '# AGENTS.md\n');
    const fakeWatchers: FakeWatcher[] = [];
    const deps: WatchDeps = {
      watch: ((_p: fs.PathLike, listener: fs.WatchListener<string>) => {
        const w = new FakeWatcher(listener);
        fakeWatchers.push(w);
        return w as unknown as fs.FSWatcher;
      }) as typeof fs.watch,
      existsSync: (p) => p === agentsPath,
    };
    const onRescore = vi.fn();
    const handle = watchAgentsFile(
      { agentsPath, claudePath: 'CLAUDE.md', debounceMs: 300 },
      onRescore,
      deps,
    );

    // Fire three rapid changes within the debounce window.
    fakeWatchers[0].fire();
    fakeWatchers[0].fire();
    fakeWatchers[0].fire();
    expect(onRescore).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onRescore).toHaveBeenCalledTimes(1);
    expect(onRescore).toHaveBeenCalledWith(agentsPath);

    handle.close();
    vi.useRealTimers();
  });

  it('respects a custom debounce interval', () => {
    vi.useFakeTimers();
    const agentsPath = writeFixture('AGENTS.md', '# AGENTS.md\n');
    let captured: FakeWatcher | null = null;
    const deps: WatchDeps = {
      watch: ((_p: fs.PathLike, listener: fs.WatchListener<string>) => {
        captured = new FakeWatcher(listener);
        return captured as unknown as fs.FSWatcher;
      }) as typeof fs.watch,
      existsSync: (p) => p === agentsPath,
    };
    const onRescore = vi.fn();
    const handle = watchAgentsFile(
      { agentsPath, claudePath: 'CLAUDE.md', debounceMs: 500 },
      onRescore,
      deps,
    );

    captured!.fire();
    vi.advanceTimersByTime(300);
    expect(onRescore).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onRescore).toHaveBeenCalledTimes(1);

    handle.close();
    vi.useRealTimers();
  });

  it('does not fire after close()', () => {
    vi.useFakeTimers();
    const agentsPath = writeFixture('AGENTS.md', '# AGENTS.md\n');
    let captured: FakeWatcher | null = null;
    const deps: WatchDeps = {
      watch: ((_p: fs.PathLike, listener: fs.WatchListener<string>) => {
        captured = new FakeWatcher(listener);
        return captured as unknown as fs.FSWatcher;
      }) as typeof fs.watch,
      existsSync: (p) => p === agentsPath,
    };
    const onRescore = vi.fn();
    const handle = watchAgentsFile(
      { agentsPath, claudePath: 'CLAUDE.md', debounceMs: 300 },
      onRescore,
      deps,
    );

    captured!.fire();
    handle.close();
    expect(captured!.closed).toBe(true);
    vi.advanceTimersByTime(300);
    expect(onRescore).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('watches both AGENTS.md and CLAUDE.md when both exist', () => {
    const agentsPath = writeFixture('AGENTS.md', '# AGENTS.md\n');
    const claudePath = writeFixture('CLAUDE.md', 'Follow AGENTS.md exactly.');
    const watched: fs.PathLike[] = [];
    const deps: WatchDeps = {
      watch: ((p: fs.PathLike, listener: fs.WatchListener<string>) => {
        watched.push(p);
        return new FakeWatcher(listener) as unknown as fs.FSWatcher;
      }) as typeof fs.watch,
      existsSync: () => true,
    };
    const handle = watchAgentsFile({ agentsPath, claudePath, debounceMs: 300 }, vi.fn(), deps);
    expect(watched).toContain(agentsPath);
    expect(watched).toContain(claudePath);
    handle.close();
  });

  it('skips files that do not exist', () => {
    const watched: fs.PathLike[] = [];
    const deps: WatchDeps = {
      watch: ((p: fs.PathLike, listener: fs.WatchListener<string>) => {
        watched.push(p);
        return new FakeWatcher(listener) as unknown as fs.FSWatcher;
      }) as typeof fs.watch,
      existsSync: (p) => p === 'AGENTS.md',
    };
    const handle = watchAgentsFile(
      { agentsPath: 'AGENTS.md', claudePath: 'CLAUDE.md', debounceMs: 300 },
      vi.fn(),
      deps,
    );
    expect(watched).toEqual(['AGENTS.md']);
    handle.close();
  });
});

describe('formatWatchResult', () => {
  it('includes grade, score, and the basename of the changed file', () => {
    const line = formatWatchResult(
      { score: 88, grade: 'B', timestamp: new Date('2026-01-01T10:20:30') },
      path.join('some', 'dir', 'AGENTS.md'),
    );
    expect(line).toContain('AGENTS.md');
    expect(line).toContain('Grade: B');
    expect(line).toContain('88/100');
    expect(line).not.toContain('dir');
  });
});
