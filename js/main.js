// 앱 시작, 라우팅, 화면 렌더링

import { markdownToHtml, escapeHtml } from './markdown.js';
import { parseFrontMatter } from './frontmatter.js';
import { initThemeToggle } from './theme.js';

const SITE_TITLE = document.title;
const app = document.getElementById('app');

let postsPromise = null;
let renderCount = 0;

// ---------- 데이터 ----------

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (HTTP ${res.status})`);
  return res.text();
}

async function fetchPosts() {
  const files = JSON.parse(await fetchText('posts/index.json'));
  if (!Array.isArray(files)) throw new Error('posts/index.json 은 파일명 배열이어야 합니다.');

  const results = await Promise.allSettled(files.map(async (file) => {
    const { data, body } = parseFrontMatter(await fetchText(`posts/${file}`));
    return {
      slug: file.replace(/\.md$/, ''),
      title: data.title || file,
      date: data.date || '',
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
      body,
    };
  }));

  const posts = [];
  const failed = [];
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') posts.push(result.value);
    else failed.push(files[idx]);
  });
  posts.sort((a, b) => b.date.localeCompare(a.date));
  return { posts, failed };
}

// 한 번 불러온 글 목록은 재사용한다 (실패하면 다음에 다시 시도)
function loadPosts() {
  if (!postsPromise) {
    postsPromise = fetchPosts().catch((err) => {
      postsPromise = null;
      throw err;
    });
  }
  return postsPromise;
}

// ---------- 라우팅 ----------

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRoute() {
  const path = location.hash.replace(/^#\/?/, '');
  const [type, ...rest] = path.split('/');
  const param = decode(rest.join('/'));

  if (!type) return { name: 'home' };
  if (type === 'post' && param) return { name: 'post', slug: param };
  if (type === 'tag' && param) return { name: 'tag', tag: param };
  return { name: 'notfound' };
}

// ---------- 화면 조각 ----------

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return escapeHtml(iso);
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

function metaHtml(post) {
  if (!post.date) return '';
  return `<p class="post-meta"><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></p>`;
}

function tagsHtml(tags) {
  if (!tags.length) return '';
  const items = tags.map((tag) => {
    const href = `#/tag/${escapeHtml(encodeURIComponent(tag))}`;
    return `<li><a class="tag" href="${href}"><span class="tag-label">#${escapeHtml(tag)}</span></a></li>`;
  });
  return `<ul class="tag-list" aria-label="태그">${items.join('')}</ul>`;
}

function failedNoticeHtml(failed) {
  if (!failed.length) return '';
  return `<div class="notice" role="alert">
    <p class="notice-title">일부 글을 불러오지 못했습니다</p>
    <p>${failed.map(escapeHtml).join(', ')} — 파일 이름이 posts/index.json 과 같은지 확인해 주세요.</p>
  </div>`;
}

// ---------- 화면 ----------

function renderList(posts, { tag = null, failed = [] } = {}) {
  const shown = tag ? posts.filter((post) => post.tags.includes(tag)) : posts;
  document.title = tag ? `#${tag} · ${SITE_TITLE}` : SITE_TITLE;

  const cards = shown.map((post) => `
    <li class="post-card">
      <article>
        <h2 class="post-card-title"><a href="#/post/${escapeHtml(encodeURIComponent(post.slug))}">${escapeHtml(post.title)}</a></h2>
        ${metaHtml(post)}
        ${post.description ? `<p class="post-card-desc">${escapeHtml(post.description)}</p>` : ''}
        ${tagsHtml(post.tags)}
      </article>
    </li>`).join('');

  app.innerHTML = `
    <h1 class="page-title">${tag ? `#${escapeHtml(tag)}` : '최근 글'}</h1>
    ${tag ? '<p><a class="back-link" href="#/">← 전체 글 보기</a></p>' : ''}
    ${failedNoticeHtml(failed)}
    ${shown.length ? `<ol class="post-list">${cards}</ol>` : '<p class="status">아직 글이 없습니다.</p>'}`;
}

function renderPost(post) {
  document.title = `${post.title} · ${SITE_TITLE}`;
  app.innerHTML = `
    <article class="post">
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        ${metaHtml(post)}
        ${tagsHtml(post.tags)}
      </header>
      <div class="prose">${markdownToHtml(post.body, { host: location.host })}</div>
      <footer class="post-footer">
        <a class="back-link" href="#/">← 글 목록으로</a>
      </footer>
    </article>`;
}

function renderNotFound(message) {
  document.title = `찾을 수 없음 · ${SITE_TITLE}`;
  app.innerHTML = `
    <h1 class="page-title">${escapeHtml(message)}</h1>
    <p><a class="back-link" href="#/">← 글 목록으로 돌아가기</a></p>`;
}

function renderError(err) {
  document.title = `오류 · ${SITE_TITLE}`;
  const hint = location.protocol === 'file:'
    ? '파일을 직접 열면 글을 불러올 수 없습니다. 로컬 서버로 열어 주세요. (예: <code>npx serve</code> 또는 VS Code Live Server)'
    : '잠시 후 새로고침해 보세요.';
  app.innerHTML = `
    <div class="notice" role="alert">
      <p class="notice-title">글을 불러오지 못했습니다</p>
      <p>${escapeHtml(err.message)}</p>
      <p>${hint}</p>
    </div>`;
}

async function render({ moveFocus = false } = {}) {
  const current = ++renderCount;
  const route = parseRoute();

  try {
    const { posts, failed } = await loadPosts();
    if (current !== renderCount) return; // 그 사이 다른 화면으로 이동함

    if (route.name === 'home') {
      renderList(posts, { failed });
    } else if (route.name === 'tag') {
      renderList(posts, { tag: route.tag });
    } else if (route.name === 'post') {
      const post = posts.find((p) => p.slug === route.slug);
      if (post) renderPost(post);
      else renderNotFound('글을 찾을 수 없습니다');
    } else {
      renderNotFound('페이지를 찾을 수 없습니다');
    }
  } catch (err) {
    if (current !== renderCount) return;
    renderError(err);
  }

  window.scrollTo(0, 0);
  if (moveFocus) app.focus({ preventScroll: true });
}

// ---------- 시작 ----------

initThemeToggle(document.getElementById('theme-toggle'));
window.addEventListener('hashchange', () => render({ moveFocus: true }));
render();
