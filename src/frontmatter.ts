import type { Frontmatter } from './types.js';

export interface FrontmatterParseResult {
  success: boolean;
  data?: Frontmatter;
  error?: string;
}

const DELIMITER = /^---\s*$/;

function stripBom(line: string): string {
  return line.charCodeAt(0) === 0xfeff ? line.slice(1) : line;
}

// Detect whether content opens with a YAML frontmatter block (--- ... ---).
export function hasFrontmatter(content: string): boolean {
  const lines = content.split('\n');
  // The very first line (ignoring a possible BOM) must be the opening delimiter.
  const first = stripBom(lines[0] ?? '');
  if (!DELIMITER.test(first)) return false;
  for (let i = 1; i < lines.length; i++) {
    if (DELIMITER.test(lines[i])) return true;
  }
  return false;
}

// Return the markdown content with any leading frontmatter block removed.
// If no frontmatter is present the content is returned unchanged.
export function stripFrontmatter(content: string): string {
  if (!hasFrontmatter(content)) return content;
  const lines = content.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (DELIMITER.test(lines[i])) {
      return lines.slice(i + 1).join('\n').replace(/^\n+/, '');
    }
  }
  return content;
}

// Parse the optional YAML frontmatter at the top of an AGENTS.md file.
// Returns null (via success=false with no error) semantics handled by caller
// when no frontmatter block exists. This is a deliberately tiny YAML reader
// that only understands the v1.1 shape: a `description` scalar and a `tags`
// list (either inline `[a, b]` or block `- a` form). Nested structures are
// intentionally unsupported.
export function parseFrontmatter(content: string): FrontmatterParseResult {
  if (!hasFrontmatter(content)) {
    return { success: false };
  }

  const lines = content.split('\n');
  const body: string[] = [];
  let closed = false;
  for (let i = 1; i < lines.length; i++) {
    if (DELIMITER.test(lines[i])) {
      closed = true;
      break;
    }
    body.push(lines[i]);
  }
  if (!closed) {
    return { success: false, error: 'Frontmatter block is not closed with "---"' };
  }

  const data: Frontmatter = { raw: body.join('\n') };

  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (line.trim().length === 0) continue;

    // Indented lines belong to a block list (handled by the tags branch below)
    // or are otherwise ignored here.
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1].toLowerCase();
    const rawValue = kv[2];

    if (key === 'description') {
      data.description = unquote(rawValue.trim());
    } else if (key === 'tags') {
      const inline = rawValue.trim();
      if (inline.length > 0) {
        data.tags = parseInlineList(inline);
      } else {
        // Block list form: subsequent indented "- value" lines.
        const collected: string[] = [];
        let j = i + 1;
        for (; j < body.length; j++) {
          const itemMatch = body[j].match(/^\s*-\s+(.*)$/);
          if (!itemMatch) {
            if (body[j].trim().length === 0) continue;
            break;
          }
          collected.push(unquote(itemMatch[1].trim()));
        }
        data.tags = collected;
        i = j - 1;
      }
    }
  }

  return { success: true, data };
}

function parseInlineList(value: string): string[] {
  let inner = value;
  if (inner.startsWith('[') && inner.endsWith(']')) {
    inner = inner.slice(1, -1);
  }
  return inner
    .split(',')
    .map((s) => unquote(s.trim()))
    .filter((s) => s.length > 0);
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

// Validate the v1.1 frontmatter fields. All fields are optional; this only
// flags fields that are present but malformed. Returns human-readable warning
// strings (empty array means valid / nothing present).
export function validateFrontmatter(data: Frontmatter): string[] {
  const warnings: string[] = [];

  if (data.description !== undefined) {
    if (typeof data.description !== 'string' || data.description.trim().length === 0) {
      warnings.push('Frontmatter "description" is present but empty — provide a short description or remove it');
    }
  }

  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags) || data.tags.length === 0) {
      warnings.push('Frontmatter "tags" is present but empty — provide at least one tag or remove it');
    } else {
      const allStrings = data.tags.every((t) => typeof t === 'string' && t.trim().length > 0);
      if (!allStrings) {
        warnings.push('Frontmatter "tags" must be a list of non-empty strings');
      }
    }
  }

  return warnings;
}
