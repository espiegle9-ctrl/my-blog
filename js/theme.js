// 다크 모드 토글
// 처음 테마는 index.html <head>의 인라인 스크립트가 정한다 (깜빡임 방지).

const STORAGE_KEY = 'theme';
const root = document.documentElement;

function getSavedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 사생활 보호 모드 등에서는 저장하지 않고 넘어간다
  }
}

function applyTheme(theme, button) {
  root.dataset.theme = theme;
  button.setAttribute('aria-pressed', String(theme === 'dark'));
}

export function initThemeToggle(button) {
  if (!button) return;

  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light', button);

  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, button);
    saveTheme(next);
  });

  // 사용자가 직접 고른 적이 없으면 OS 설정 변경을 따라간다
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', (event) => {
    if (!getSavedTheme()) applyTheme(event.matches ? 'dark' : 'light', button);
  });
}
