// @ts-ignore
import fs from 'node:fs';
// @ts-ignore
import path from 'node:path';
// @ts-ignore
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MCP_TOOL_NAMES } from '../domain/mcpProtocol';
import { SHOT_TYPES } from '../domain/shotTypeRules';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const MANUAL_DIR = path.resolve(currentDir, '../../docs/manual');
const EXPECTED_FILES = [
  'README.md',
  '01-introduction-and-mental-model.md',
  '02-terminologies-and-glossary.md',
  '03-user-guide-library-and-templates.md',
  '04-user-guide-scene-authoring.md',
  '05-user-guide-projects-and-continuity.md',
  '06-user-guide-ai-collaboration.md',
  '07-inside-krakinai-engines.md',
  '08-technical-architecture-and-storage.md',
  '09-technical-changeset-and-security.md',
  '10-technical-mcp-reference.md',
];

describe('KRAKINAI Manual Integrity', () => {
  it('contains all 11 manual files with substantial content and valid relative chapter links', () => {
    for (const file of EXPECTED_FILES) {
      const fullPath = path.join(MANUAL_DIR, file);
      expect(fs.existsSync(fullPath), `Missing ${file}`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.length).toBeGreaterThan(1500);

      const linkRegex = /\]\(\.\/([^)#]+)(?:#[^)]*)?\)/g;
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(content)) !== null) {
        const targetPath = path.join(MANUAL_DIR, match[1]);
        expect(fs.existsSync(targetPath), `Broken link ./${match[1]} in ${file}`).toBe(true);
      }
    }
  });

  it('documents all 38 MCP tools in Chapter 10, all Preflight rules P000-P008 and Shot Types in Chapter 7, and ChangeSet v1-v6 in Chapter 9', () => {
    const ch7 = fs.readFileSync(path.join(MANUAL_DIR, '07-inside-krakinai-engines.md'), 'utf8');
    for (const rule of ['P000', 'P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008']) {
      expect(ch7).toContain(rule);
    }
    for (const shotType of SHOT_TYPES) {
      expect(ch7).toContain(shotType);
    }

    const ch9 = fs.readFileSync(path.join(MANUAL_DIR, '09-technical-changeset-and-security.md'), 'utf8');
    for (let v = 1; v <= 7; v++) {
      expect(ch9).toContain(`krakinai.change-set.v${v}`);
    }

    const ch10 = fs.readFileSync(path.join(MANUAL_DIR, '10-technical-mcp-reference.md'), 'utf8');
    expect(MCP_TOOL_NAMES).toHaveLength(45);
    for (const toolName of MCP_TOOL_NAMES) {
      expect(ch10, `Missing MCP tool ${toolName} in Chapter 10`).toContain(toolName);
    }
  });
});
