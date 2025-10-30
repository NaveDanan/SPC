/*
  Minimal Markdown + LaTeX renderer
  - Escapes HTML by default (XSS safe)
  - Supports: headings (#..######), bold **text**, italic *text*, inline code `code`,
    code blocks ```lang\n...```, links [label](url), lists (-, *, 1.),
    inline math $...$ and block math $$...$$ (displayed raw unless KaTeX/MathJax loaded)
*/

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeUrl = (url: string): string => {
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:' || u.protocol === 'tel:') {
      return u.toString();
    }
  } catch {
    // fallthrough
  }
  return '#';
};

type Token =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string | null; content: string };

const tokenizeCodeBlocks = (md: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < md.length) {
    const start = md.indexOf('```', i);
    if (start === -1) {
      tokens.push({ type: 'text', content: md.slice(i) });
      break;
    }
    // Push any text prior to code block
    if (start > i) tokens.push({ type: 'text', content: md.slice(i, start) });

    const j = start + 3;
    // capture optional language
    let lang: string | null = null;
    // read until end-of-line for language spec
    let eol = md.indexOf('\n', j);
    if (eol === -1) eol = md.length;
    const firstLine = md.slice(j, eol).trim();
    if (firstLine && !firstLine.includes('```')) lang = firstLine;

    const codeStart = eol === md.length ? eol : eol + 1;
    const end = md.indexOf('```', codeStart);
    if (end === -1) {
      // no closing fence; treat rest as code
      tokens.push({ type: 'code', lang, content: md.slice(codeStart) });
      break;
    }
    tokens.push({ type: 'code', lang, content: md.slice(codeStart, end) });
    i = end + 3;
  }
  return tokens;
};

// Split inline text by backticks for inline code and apply formatting to the text parts
const renderInline = (raw: string): string => {
  // Escape HTML first
  const safe = escapeHtml(raw);

  // Split by inline code marks (single backticks)
  const parts: string[] = [];
  let i = 0;
  while (i < safe.length) {
    const start = safe.indexOf('`', i);
    if (start === -1) {
      parts.push(safe.slice(i));
      break;
    }
    const end = safe.indexOf('`', start + 1);
    if (end === -1) {
      parts.push(safe.slice(i));
      break;
    }
    // text before code
    if (start > i) parts.push(safe.slice(i, start));
    const code = safe.slice(start + 1, end);
    parts.push(`<code class="mkd-inline">${code}</code>`);
    i = end + 1;
  }

  const processText = (text: string): string => {
    // Inline math $...$
    text = text.replace(/\$(.+?)\$/g, (_m, g1) => `<span class="mkd-math" data-math="${g1.replace(/"/g, '&quot;')}"></span>`);
    // Bold **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
      const clean = sanitizeUrl(url);
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    });
    // Line breaks (preserve)
    return text.replace(/\n/g, '<br/>');
  };

  // Merge back applying formatting only to non-code parts
  let html = '';
  for (const part of parts) {
    if (part.startsWith('<code ')) {
      html += part;
    } else {
      html += processText(part);
    }
  }
  return html;
};

type Align = 'left' | 'center' | 'right';

const splitTableLine = (line: string): string[] => {
  // Support leading/trailing pipes; split and trim cells
  const raw = line.trim();
  const noOuter = raw.replace(/^\|/, '').replace(/\|$/, '');
  return noOuter.split('|').map((c) => c.trim());
};

const parseAlignSpec = (cell: string): Align | null => {
  const t = cell.trim();
  if (!/^:?-{3,}:?$/.test(t)) return null;
  const left = t.startsWith(':');
  const right = t.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
};

const tryParseTable = (lines: string[], startIndex: number): { html: string; nextIndex: number } | null => {
  if (startIndex + 1 >= lines.length) return null;
  const headerLine = lines[startIndex];
  const delimLine = lines[startIndex + 1];
  if (!headerLine.includes('|') || !delimLine.includes('-')) return null;
  const headers = splitTableLine(headerLine);
  const alignSpecs = splitTableLine(delimLine).map(parseAlignSpec);
  if (alignSpecs.length < 1 || alignSpecs.some((a) => a === null)) return null;
  const colCount = Math.min(headers.length, alignSpecs.length);
  if (colCount < 1) return null;

  // Gather body rows until blank line or a non-table line
  const rows: string[][] = [];
  let i = startIndex + 2;
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.trim() === '') break;
    if (!ln.includes('|')) break;
    const cells = splitTableLine(ln);
    if (cells.length < 1) break;
    rows.push(cells);
    i++;
  }

  const alignFor = (idx: number): Align => (alignSpecs[idx] as Align) ?? 'left';
  const esc = (s: string) => s; // already processed by inline renderer later

  let html = '<div class="mkd-table-wrap"><table class="mkd-table"><thead><tr>';
  for (let c = 0; c < colCount; c++) {
    const content = renderInline(headers[c] ?? '');
    const align = alignFor(c);
    html += `<th style="text-align:${align}">${content}</th>`;
  }
  html += '</tr></thead>';

  html += '<tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (let c = 0; c < colCount; c++) {
      const content = renderInline(esc(row[c] ?? ''));
      const align = alignFor(c);
      html += `<td style="text-align:${align}">${content}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  return { html, nextIndex: i };
};

// Fallback: render any contiguous block of pipe-delimited lines as a table
// even if the formal alignment delimiter line is missing or malformed.
const tryParseLooseTable = (lines: string[], startIndex: number): { html: string; nextIndex: number } | null => {
  const isPipeLine = (ln: string) => /\|/.test(ln);
  if (!isPipeLine(lines[startIndex])) return null;

  // Require at least 2 consecutive pipe lines to avoid false positives
  let i = startIndex;
  const block: string[] = [];
  while (i < lines.length && lines[i].trim() !== '' && isPipeLine(lines[i])) {
    block.push(lines[i]);
    i++;
  }
  if (block.length < 2) return null;

  // If second line is a valid alignment delimiter, delegate to strict parser
  if (block.length >= 2 && splitTableLine(block[1]).every((c) => parseAlignSpec(c) !== null)) {
    return tryParseTable(lines, startIndex);
  }

  const rows = block.map(splitTableLine);
  const colCount = rows.reduce((min, r) => Math.min(min, r.length), rows[0].length);
  if (colCount < 1) return null;

  const header = rows[0];
  const body = rows.slice(1);

  let html = '<div class="mkd-table-wrap"><table class="mkd-table"><thead><tr>';
  for (let c = 0; c < colCount; c++) {
    html += `<th style="text-align:left">${renderInline(header[c] ?? '')}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of body) {
    html += '<tr>';
    for (let c = 0; c < colCount; c++) {
      html += `<td style="text-align:left">${renderInline(row[c] ?? '')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return { html, nextIndex: startIndex + block.length };
};

const renderTextBlock = (text: string): string => {
  // Handle block math $$...$$ across lines
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let i = 0;
  let inList: null | 'ul' | 'ol' = null;
  let inBlockMath = false;
  let mathBuffer: string[] = [];

  const closeListIfNeeded = () => {
    if (inList) {
      html += inList === 'ul' ? '</ul>' : '</ol>';
      inList = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Block math start
    if (!inBlockMath && line.trim().startsWith('$$')) {
      inBlockMath = true;
      const rest = line.trim().slice(2);
      if (rest.endsWith('$$') && rest.length > 2) {
        // Single line $$...$$
        const expr = rest.slice(0, -2).trim();
        html += `<div class="mkd-math-block" data-math="${escapeHtml(expr)}" data-display="block"></div>`;
        i++;
        continue;
      } else {
        mathBuffer = [rest];
        i++;
        continue;
      }
    }

    if (inBlockMath) {
      const trimmed = line.trim();
      if (trimmed.endsWith('$$')) {
        mathBuffer.push(trimmed.slice(0, -2));
        const expr = mathBuffer.join('\n');
        html += `<div class="mkd-math-block" data-math="${escapeHtml(expr)}" data-display="block"></div>`;
        inBlockMath = false;
        mathBuffer = [];
        i++;
        continue;
      } else {
        mathBuffer.push(line);
        i++;
        continue;
      }
    }

    // Headings
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      closeListIfNeeded();
      const level = m[1].length;
      const content = renderInline(m[2]);
      html += `<h${level} class="mkd-h${level}">${content}</h${level}>`;
      i++;
      continue;
    }

    // Lists
    const olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    const ulMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    if (olMatch || ulMatch) {
      const desired: 'ul' | 'ol' = olMatch ? 'ol' : 'ul';
      if (inList !== desired) {
        closeListIfNeeded();
        html += desired === 'ul' ? '<ul class="mkd-ul">' : '<ol class="mkd-ol">';
        inList = desired;
      }
      const liContent = renderInline((olMatch || ulMatch)![1]);
      html += `<li>${liContent}</li>`;
      i++;
      continue;
    }

    // Tables (GitHub-style pipe tables)
    let tableParsed = tryParseTable(lines, i);
    if (!tableParsed) {
      tableParsed = tryParseLooseTable(lines, i);
    }
    if (tableParsed) {
      closeListIfNeeded();
      html += tableParsed.html;
      i = tableParsed.nextIndex;
      continue;
    }

    // Blank line closes list and adds paragraph break
    if (line.trim() === '') {
      closeListIfNeeded();
      html += '<div class="mkd-br"></div>';
      i++;
      continue;
    }

    // Paragraph text
    closeListIfNeeded();
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '') {
      // stop paragraph on next block boundary (heading or list)
      if (/^(#{1,6})\s+/.test(lines[i]) || /^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]) || lines[i].trim().startsWith('$$')) {
        break;
      }
      para.push(lines[i]);
      i++;
    }
    const textContent = renderInline(para.join('\n'));
    html += `<p class="mkd-p">${textContent}</p>`;
  }

  closeListIfNeeded();
  return html;
};

export const markdownToHtml = (md: string): string => {
  const tokens = tokenizeCodeBlocks(md.replace(/\r\n?/g, '\n'));
  let html = '';
  for (const t of tokens) {
    if (t.type === 'text') {
      html += renderTextBlock(t.content);
    } else {
      html += `<pre class="mkd-pre"><code class="mkd-code${t.lang ? ` language-${escapeHtml(t.lang)}` : ''}">${escapeHtml(
        t.content
      )}</code></pre>`;
    }
  }
  return html;
};

export const tryRenderMathIn = (root: HTMLElement): void => {
  const w = window as unknown as {
    katex?: { render: (expr: string, el: Element, opts?: Record<string, unknown>) => void };
    MathJax?: { typesetPromise?: (el?: unknown) => Promise<void> };
  };
  const katex = w.katex;
  const mathjax = w.MathJax;

  if (katex) {
    const nodes = root.querySelectorAll('[data-math]');
    nodes.forEach((node) => {
      const el = node as HTMLElement;
      const expr = el.getAttribute('data-math') || '';
      const display = el.getAttribute('data-display') === 'block';
      try {
        katex.render(expr, el, { throwOnError: false, displayMode: display });
      } catch {
        // Leave as-is if rendering fails
      }
    });
    return;
  }

  if (mathjax && typeof mathjax.typesetPromise === 'function') {
    // MathJax will parse TeX in the DOM. We first unwrap our placeholders.
    const inline = root.querySelectorAll('span.mkd-math[data-math]');
    inline.forEach((el) => {
      const expr = (el as HTMLElement).getAttribute('data-math') || '';
      el.textContent = `$${expr}$`;
    });
    const blocks = root.querySelectorAll('div.mkd-math-block[data-math]');
    blocks.forEach((el) => {
      const expr = (el as HTMLElement).getAttribute('data-math') || '';
      el.textContent = `$$${expr}$$`;
    });
    try {
      mathjax.typesetPromise?.([root]);
    } catch {
      // ignore
    }
  }
};
