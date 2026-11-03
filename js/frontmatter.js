// 글 맨 위의 --- 로 감싼 메타데이터(front matter) 파서
// 지원 형식: `key: value`, `key: [a, b, c]`

const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

export function parseFrontMatter(text) {
  const normalized = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(FRONT_MATTER_RE);
  if (!match) return { data: {}, body: normalized };

  const data = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (m) data[m[1]] = parseValue(m[2]);
  }
  return { data, body: normalized.slice(match[0].length) };
}

function parseValue(raw) {
  if (/^\[.*\]$/.test(raw)) {
    return raw
      .slice(1, -1)
      .split(',')
      .map((v) => unquote(v.trim()))
      .filter(Boolean);
  }
  return unquote(raw);
}

function unquote(value) {
  return value.replace(/^(['"])(.*)\1$/, '$2');
}
