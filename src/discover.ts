import * as fs from 'fs';
import * as path from 'path';

const KNOWN_FILES = [
  '.github/copilot-instructions.md',
  '.cursor/rules',
  '.cursorrules',
  '.windsurfrules',
  '.aider/conventions.md',
  'CONVENTIONS.md',
];

export function discoverFiles(dir = '.'): string[] {
  const found: string[] = [];
  for (const file of KNOWN_FILES) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) {
      found.push(full);
    }
  }
  return found;
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out', 'target', 'vendor']);

// Recursively find all AGENTS.md files under a directory (monorepo-aware).
// Used to decide whether a project is a monorepo so the frontmatter
// recommendation can be surfaced. Bounded depth keeps this cheap on large trees.
export function discoverAgentsFiles(dir = '.', maxDepth = 6): string[] {
  const found: string[] = [];

  const walk = (current: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(path.join(current, entry.name), depth + 1);
      } else if (entry.isFile() && entry.name === 'AGENTS.md') {
        found.push(path.join(current, entry.name));
      }
    }
  };

  walk(dir, 0);
  return found;
}
