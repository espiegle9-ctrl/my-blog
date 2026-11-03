// 마크다운 → HTML 변환기
// DOM에 의존하지 않는 순수 함수만 둔다.

const FENCE_RE = /^\s*```\s*([\w+-]*)\s*$/;
const FENCE_END_RE = /^\s*```\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const HR_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s*>/;
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// options.host: 현재 사이트 도메인. 이 도메인이 아닌 http(s) 링크는 새 탭으로 연다.
export function markdownToHtml(markdown, options = {}) {
  const lines = String(markdown)
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .split('\n');
  return parseBlocks(lines, options);
}

// ---------- 블록 ----------

function parseBlocks(lines, opts) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !FENCE_END_RE.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // 닫는 ``` 건너뛰기
      const langClass = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : '';
      out.push(`<pre><code${langClass}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2], opts)}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoted = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        quoted.push(lines[i].replace(/^\s*> ?/, ''));
        i++;
      }
      out.push(`<blockquote>${parseBlocks(quoted, opts)}</blockquote>`);
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(cellAlign);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, aligns, rows, opts));
      continue;
    }

    if (LIST_RE.test(line)) {
      const { html, next } = parseList(lines, i, opts);
      out.push(html);
      i = next;
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !isBlockStart(lines, i))) {
      para.push(lines[i].replace(/^\s+/, ''));
      i++;
    }
    out.push(`<p>${renderInline(para.join('\n').trimEnd(), opts)}</p>`);
  }

  return out.join('\n');
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return FENCE_RE.test(line)
    || HEADING_RE.test(line)
    || HR_RE.test(line)
    || QUOTE_RE.test(line)
    || LIST_RE.test(line)
    || isTableStart(lines, i);
}

// ---------- 목록 ----------

function parseList(lines, start, opts) {
  const first = lines[start].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;

  // 같은 목록에 속하는 항목인지 (들여쓰기가 거의 같고, 순서 유무가 같음)
  const isSibling = (m) => m && m[1].length <= baseIndent + 1 && /\d/.test(m[2]) === ordered;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(LIST_RE);

    if (!line.trim()) {
      // 빈 줄 뒤에 같은 목록 항목이 이어지면 목록을 계속한다
      if (i + 1 < lines.length && isSibling(lines[i + 1].match(LIST_RE))) {
        i++;
        continue;
      }
      break;
    }

    const current = items[items.length - 1];
    if (m && m[1].length <= baseIndent + 1) {
      if (!isSibling(m)) break;
      items.push({ lines: [m[3]], children: [] });
    } else if (m) {
      current.children.push(line);
    } else if (/^\s/.test(line)) {
      if (current.children.length) current.children.push(line);
      else current.lines.push(line.trim());
    } else {
      break;
    }
    i++;
  }

  const tag = ordered ? 'ol' : 'ul';
  const startNum = parseInt(first[2], 10);
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  const body = items.map((item) => {
    const nested = item.children.length ? parseBlocks(dedent(item.children), opts) : '';
    return `<li>${renderInline(item.lines.join('\n'), opts)}${nested}</li>`;
  }).join('\n');

  return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, next: i };
}

function dedent(lines) {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
  const min = Math.min(...indents);
  return lines.map((l) => l.slice(min));
}

// ---------- 표 ----------

function isTableStart(lines, i) {
  const next = lines[i + 1];
  return lines[i].includes('|') && next !== undefined && next.includes('|') && TABLE_SEP_RE.test(next);
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function cellAlign(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
}

function renderTable(header, aligns, rows, opts) {
  const cell = (tag, text, idx) => {
    const style = aligns[idx] ? ` style="text-align: ${aligns[idx]}"` : '';
    return `<${tag}${style}>${renderInline(text || '', opts)}</${tag}>`;
  };
  const head = `<tr>${header.map((text, idx) => cell('th', text, idx)).join('')}</tr>`;
  const body = rows
    .map((row) => `<tr>${header.map((_, idx) => cell('td', row[idx], idx)).join('')}</tr>`)
    .join('\n');
  return `<div class="table-wrap"><table>\n<thead>${head}</thead>\n<tbody>\n${body}\n</tbody>\n</table></div>`;
}

// ---------- 인라인 ----------

// 이미 변환된 HTML 조각은 자리표시자로 빼 두었다가 마지막에 되돌린다.
// 그래야 링크 주소나 코드 안의 * 같은 문자가 강조 문법으로 바뀌지 않는다.
function renderInline(text, opts) {
  const tokens = [];
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;

  let s = escapeHtml(text);

  s = s.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${code}</code>`));

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const url = safeUrl(src);
    if (!url) return alt;
    return stash(`<img src="${url}" alt="${alt}" loading="lazy">`);
  });

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = safeUrl(href);
    const inner = renderEmphasis(label);
    if (!url) return inner;
    const external = isExternal(url, opts.host) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return stash(`<a href="${url}"${external}>${inner}</a>`);
  });

  s = renderEmphasis(s);
  s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');

  return restore(s, tokens);
}

function renderEmphasis(s) {
  return s
    .replace(/\*\*(?=\S)(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(?=\S)(.+?)~~/g, '<del>$1</del>')
    .replace(/\*(?=\S)([^*]+?)\*/g, '<em>$1</em>');
}

function restore(s, tokens) {
  const placeholder = /\u0000(\d+)\u0000/g;
  while (placeholder.test(s)) {
    s = s.replace(placeholder, (_, n) => tokens[n]);
  }
  return s;
}

// javascript:, vbscript:, data: 주소는 막는다. 허용되지 않으면 null.
function safeUrl(url) {
  const compact = url.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
  if (/^(javascript|vbscript|data):/.test(compact)) return null;
  return url;
}

function isExternal(url, host) {
  const m = url.match(/^https?:\/\/([^/?#]+)/i);
  if (!m) return false;
  return !host || m[1].toLowerCase() !== host.toLowerCase();
}
