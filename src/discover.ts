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
