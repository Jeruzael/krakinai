import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MANUAL_DIR = path.join(ROOT_DIR, 'docs', 'manual');
const DIST_DIR = path.join(MANUAL_DIR, 'dist');

const CHAPTER_FILES = [
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

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const htmlParts = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];
  let inTable = false;
  let tableHeaderDone = false;
  let inList = false;
  let listType = 'ul';

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${listType}>`);
      inList = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      htmlParts.push('</tbody></table></div>');
      inTable = false;
      tableHeaderDone = false;
    }
  };

  const formatInline = (text) => {
    let t = text;
    // Replace internal relative links like [Ch 1](./01-introduction-and-mental-model.md)
    t = t.replace(/\[([^\]]+)\]\(\.\/([^)#]+)(?:#([^)]*))?\)/g, (_match, label, file, hash) => {
      const targetHash = hash || slugify(file.replace(/\.md$/, ''));
      return `<a href="#${targetHash}">${label}</a>`;
    });
    // Normal markdown links [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Inline code `code`
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **text**
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    t = t.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    return t;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Fenced Code Block delimiter
    if (rawLine.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const codeText = escapeHtml(codeLines.join('\n'));
        if (codeLang === 'mermaid') {
          htmlParts.push(`<pre class="mermaid">${codeLines.join('\n')}</pre>`);
        } else {
          htmlParts.push(`<pre><code class="language-${codeLang || 'text'}">${codeText}</code></pre>`);
        }
        inCodeBlock = false;
        codeLines = [];
        codeLang = '';
      } else {
        closeList();
        closeTable();
        inCodeBlock = true;
        codeLang = rawLine.slice(3).trim();
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();

    // Blank line
    if (!trimmed) {
      closeList();
      closeTable();
      continue;
    }

    // Markdown Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      // Check if separator row |---|---|
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        tableHeaderDone = true;
        continue;
      }

      if (!inTable) {
        htmlParts.push('<div class="table-container"><table>');
        htmlParts.push('<thead><tr>');
        cells.forEach((c) => htmlParts.push(`<th>${formatInline(c)}</th>`));
        htmlParts.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        htmlParts.push('<tr>');
        cells.forEach((c) => htmlParts.push(`<td>${formatInline(c)}</td>`));
        htmlParts.push('</tr>');
      }
      continue;
    } else {
      closeTable();
    }

    // Horizontal Rule
    if (/^---+$|^\*\*\*+$/.test(trimmed)) {
      closeList();
      htmlParts.push('<hr />');
      continue;
    }

    // Headers
    if (trimmed.startsWith('#')) {
      closeList();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const id = slugify(text);
        htmlParts.push(`<h${level} id="${id}">${formatInline(text)}</h${level}>`);
        continue;
      }
    }

    // Blockquotes & Alerts
    if (trimmed.startsWith('>')) {
      closeList();
      let quoteText = trimmed.replace(/^>\s*/, '');
      let alertClass = 'quote';
      if (/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(quoteText)) {
        const type = quoteText.match(/^\[!([A-Z]+)\]/i)[1].toLowerCase();
        alertClass = `alert alert-${type}`;
        quoteText = quoteText.replace(/^\[![A-Z]+\]\s*/i, '');
      }
      htmlParts.push(`<blockquote class="${alertClass}">${formatInline(quoteText)}</blockquote>`);
      continue;
    }

    // Unordered List
    if (/^[-*+]\s+/.test(trimmed)) {
      if (!inList || listType !== 'ul') {
        closeList();
        htmlParts.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      const itemText = trimmed.replace(/^[-*+]\s+/, '');
      htmlParts.push(`<li>${formatInline(itemText)}</li>`);
      continue;
    }

    // Ordered List
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listType !== 'ol') {
        closeList();
        htmlParts.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      const itemText = trimmed.replace(/^\d+\.\s+/, '');
      htmlParts.push(`<li>${formatInline(itemText)}</li>`);
      continue;
    }

    // Paragraph
    closeList();
    htmlParts.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeList();
  closeTable();

  return htmlParts.join('\n');
}

function findBrowserBinary() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);

  for (const bin of candidates) {
    if (fs.existsSync(bin)) {
      return bin;
    }
  }
  return null;
}

export function buildManual() {
  console.log('=== Compiling KRAKINAI Official Manual ===');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const sectionsHtml = [];

  for (let i = 0; i < CHAPTER_FILES.length; i++) {
    const filename = CHAPTER_FILES[i];
    const filePath = path.join(MANUAL_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing manual file: ${filePath}`);
    }

    const mdContent = fs.readFileSync(filePath, 'utf8');
    const chapterHtml = parseMarkdown(mdContent);
    const chapterId = slugify(filename.replace(/\.md$/, ''));

    sectionsHtml.push(`
      <section class="chapter-container" id="${chapterId}">
        ${chapterHtml}
      </section>
    `);
    console.log(`✓ Processed ${filename} (${mdContent.length} chars)`);
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KRAKINAI: The Complete Manual & Architecture Guide</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm;
      @bottom-right {
        content: counter(page);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .chapter-container {
      page-break-before: always;
      padding-top: 10px;
    }
    .chapter-container:first-of-type {
      page-break-before: avoid;
    }
    h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 14px;
      page-break-after: avoid;
    }
    h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    h4 {
      font-size: 10pt;
      font-weight: 600;
      color: #475569;
      margin-top: 10px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }
    p {
      margin-top: 0;
      margin-bottom: 9px;
      text-align: justify;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 9px;
      padding-left: 20px;
    }
    li {
      margin-bottom: 3px;
    }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 2px 4px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 8pt;
      line-height: 1.4;
      overflow-x: auto;
      margin-top: 6px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
      font-size: inherit;
    }
    blockquote {
      margin: 10px 0;
      padding: 8px 14px;
      background-color: #f8fafc;
      border-left: 4px solid #94a3b8;
      border-radius: 0 4px 4px 0;
      font-style: italic;
      color: #475569;
      page-break-inside: avoid;
    }
    blockquote.alert-important {
      background-color: #fef2f2;
      border-left-color: #ef4444;
      color: #991b1b;
      font-style: normal;
    }
    blockquote.alert-note {
      background-color: #eff6ff;
      border-left-color: #3b82f6;
      color: #1e40af;
      font-style: normal;
    }
    blockquote.alert-tip {
      background-color: #f0fdf4;
      border-left-color: #22c55e;
      color: #166534;
      font-style: normal;
    }
    blockquote.alert-warning {
      background-color: #fffbeb;
      border-left-color: #f59e0b;
      color: #92400e;
      font-style: normal;
    }
    .table-container {
      width: 100%;
      margin: 10px 0;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    hr {
      border: 0;
      border-top: 1px solid #cbd5e1;
      margin: 16px 0;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .mermaid {
      background-color: #f8fafc;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      font-family: inherit;
      padding: 8px;
      border-radius: 6px;
      white-space: pre-wrap;
      font-size: 7.5pt;
    }
  </style>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
  </script>
</head>
<body>
  ${sectionsHtml.join('\n')}
</body>
</html>`;

  const htmlOutputPath = path.join(DIST_DIR, 'KRAKINAI-Manual.html');
  fs.writeFileSync(htmlOutputPath, fullHtml, 'utf8');
  console.log(`\n✓ Generated Standalone HTML Manual: ${htmlOutputPath} (${(fullHtml.length / 1024).toFixed(1)} KB)`);

  const browserBin = findBrowserBinary();
  const pdfOutputPath = path.join(DIST_DIR, 'KRAKINAI-Manual.pdf');

  if (browserBin) {
    console.log(`\nRendering PDF via Headless Browser: ${browserBin}`);
    try {
      execFileSync(browserBin, [
        '--headless',
        '--disable-gpu',
        '--run-all-compositor-stages-before-draw',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfOutputPath}`,
        `file:///${htmlOutputPath.replace(/\\/g, '/')}`,
      ], { timeout: 30000 });

      if (fs.existsSync(pdfOutputPath)) {
        const stats = fs.statSync(pdfOutputPath);
        console.log(`✓ Rendered Publication PDF: ${pdfOutputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
      }
    } catch (err) {
      console.warn(`! Headless PDF generation warning: ${err.message}`);
      console.log(`  You can open ${htmlOutputPath} in your browser and select Print -> Save as PDF.`);
    }
  } else {
    console.log('\nNotice: No headless Chromium/Edge binary found.');
    console.log(`You can open ${htmlOutputPath} in your browser and select Print -> Save as PDF.`);
  }

  console.log('\n=== Manual Build Completed Successfully ===');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildManual();
}
