import { describe, it, expect } from 'vitest';
import {
  hasFrontmatter,
  parseFrontmatter,
  stripFrontmatter,
  validateFrontmatter,
} from './frontmatter.js';

const WITH_FM = `---
description: Backend service instructions
tags: [backend, api]
---

# AGENTS.md

## Mission
Do stuff.
`;

const BLOCK_TAGS = `---
description: "API gateway"
tags:
  - gateway
  - edge
---
# AGENTS.md
`;

const NO_FM = `# AGENTS.md

## Mission
Do stuff.
`;

describe('hasFrontmatter', () => {
  it('detects a frontmatter block', () => {
    expect(hasFrontmatter(WITH_FM)).toBe(true);
  });

  it('returns false when there is no frontmatter', () => {
    expect(hasFrontmatter(NO_FM)).toBe(false);
  });

  it('returns false for an unterminated block', () => {
    expect(hasFrontmatter('---\ndescription: x\n# AGENTS.md\n')).toBe(false);
  });

  it('ignores a horizontal rule that is not at the top', () => {
    expect(hasFrontmatter('# Title\n\n---\n')).toBe(false);
  });
});

describe('parseFrontmatter', () => {
  it('extracts YAML between --- delimiters', () => {
    const result = parseFrontmatter(WITH_FM);
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('Backend service instructions');
    expect(result.data?.tags).toEqual(['backend', 'api']);
  });

  it('parses block-style tag lists and quoted strings', () => {
    const result = parseFrontmatter(BLOCK_TAGS);
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('API gateway');
    expect(result.data?.tags).toEqual(['gateway', 'edge']);
  });

  it('returns success=false when no frontmatter is present', () => {
    const result = parseFrontmatter(NO_FM);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it('handles malformed frontmatter gracefully (unterminated -> no fm)', () => {
    const result = parseFrontmatter('---\ndescription: x\n');
    expect(result.success).toBe(false);
  });

  it('ignores unknown keys without failing', () => {
    const result = parseFrontmatter('---\ndescription: x\nfoo: bar\n---\n# T\n');
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('x');
  });
});

describe('stripFrontmatter', () => {
  it('removes the frontmatter block', () => {
    const stripped = stripFrontmatter(WITH_FM);
    expect(stripped.startsWith('# AGENTS.md')).toBe(true);
    expect(stripped).not.toContain('description:');
  });

  it('returns content unchanged when there is no frontmatter', () => {
    expect(stripFrontmatter(NO_FM)).toBe(NO_FM);
  });
});

describe('validateFrontmatter', () => {
  it('returns no warnings for valid fields', () => {
    expect(validateFrontmatter({ description: 'ok', tags: ['a'] })).toEqual([]);
  });

  it('returns no warnings when fields are absent', () => {
    expect(validateFrontmatter({})).toEqual([]);
  });

  it('warns on empty description', () => {
    const warnings = validateFrontmatter({ description: '   ' });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('description');
  });

  it('warns on empty tags array', () => {
    const warnings = validateFrontmatter({ tags: [] });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('tags');
  });

  it('warns when tags contains a non-string / empty entry', () => {
    const warnings = validateFrontmatter({ tags: ['ok', ''] });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('tags');
  });
});
