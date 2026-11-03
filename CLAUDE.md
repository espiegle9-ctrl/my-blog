# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에게 프로젝트 맥락과 규칙을 알려줍니다.

## 프로젝트 개요

마크다운(`.md`) 파일로 쓴 글을 읽어 블로그 웹사이트로 보여주는 정적 사이트입니다.
브라우저에서 마크다운 파일을 `fetch`로 불러와 HTML로 변환해 렌더링합니다.

## 기술 원칙

- **프레임워크·빌드 도구 없음.** 순수 HTML, CSS, JavaScript(ES 모듈)만 사용합니다.
  - React, Vue, Svelte, Tailwind, Bootstrap, jQuery 등을 도입하지 않습니다.
  - npm, 번들러(Webpack/Vite 등), 트랜스파일러를 쓰지 않습니다. 파일을 그대로 서빙하면 동작해야 합니다.
  - 외부 라이브러리가 꼭 필요하다고 판단되면 먼저 사용자에게 물어봅니다.
- **마크다운 파서는 직접 구현합니다** (`js/markdown.js`). 지원 범위는 아래 "마크다운 지원 범위" 참고.
- 최신 브라우저(Chrome, Edge, Safari, Firefox 최신 2개 버전) 기준으로 작성합니다. 구형 브라우저 폴리필은 넣지 않습니다.

## 디렉터리 구조

```
my-blog/
├── index.html          # 단일 진입점 (글 목록 + 글 상세를 모두 이 페이지에서 렌더링)
├── css/
│   └── style.css       # 전체 스타일 (CSS 변수로 라이트/다크 테마 정의)
├── js/
│   ├── main.js         # 앱 시작, 라우팅, 화면 렌더링
│   ├── markdown.js     # 마크다운 → HTML 변환기
│   ├── frontmatter.js  # 글 상단 메타데이터 파싱
│   └── theme.js        # 다크 모드 토글 및 저장
├── posts/
│   ├── index.json      # 글 목록 매니페스트 (파일명 배열)
│   └── *.md            # 블로그 글
└── images/             # 글에서 쓰는 이미지
```

구조를 바꾸거나 파일을 추가할 때는 이 섹션도 함께 갱신합니다.

## 글 작성 규칙

### 파일 위치와 이름

- 글은 `posts/` 아래에 둡니다. 파일명은 영문 소문자와 하이픈만 사용합니다: `posts/my-first-post.md`
- 파일명(확장자 제외)이 곧 글의 slug이자 URL이 됩니다.
- 새 글을 추가하면 **반드시 `posts/index.json`에 파일명을 추가**합니다. 브라우저는 폴더 목록을 읽을 수 없기 때문에 이 매니페스트가 글 목록의 유일한 출처입니다.

```json
["my-first-post.md", "dark-mode-notes.md"]
```

### Front matter

모든 글은 맨 위에 `---`로 감싼 메타데이터를 둡니다.

```markdown
---
title: 첫 번째 글
date: 2026-10-29
description: 목록과 미리보기에 표시될 한 줄 요약
tags: [일상, 개발]
---

본문은 여기서부터 시작합니다.
```

- `title`, `date`는 필수, `description`, `tags`는 선택입니다.
- 글 안의 이미지·링크 경로는 `posts/` 폴더가 아니라 **사이트 루트 기준**입니다: `![설명](images/photo.jpg)`
- 다른 글로 가는 링크는 `[제목](#/post/<slug>)` 형식으로 씁니다.
- `date`는 `YYYY-MM-DD` 형식이며, 글 목록은 날짜 내림차순으로 정렬합니다.
- front matter 파서는 단순한 `key: value`와 `[a, b]` 형태의 배열만 지원하면 됩니다.

## 라우팅

서버 설정 없이 GitHub Pages 같은 정적 호스팅에서도 동작하도록 **해시 라우팅**을 사용합니다.

| URL | 화면 |
|---|---|
| `#/` 또는 해시 없음 | 글 목록 |
| `#/post/<slug>` | 글 상세 |
| `#/tag/<태그>` | 태그별 글 목록 |

- `hashchange` 이벤트로 화면을 다시 그립니다.
- 존재하지 않는 slug는 "글을 찾을 수 없습니다" 화면과 목록으로 돌아가는 링크를 보여줍니다.
- 화면이 바뀔 때마다 `document.title`을 갱신하고 스크롤을 맨 위로 올립니다.

## 마크다운 지원 범위

`js/markdown.js`가 지원해야 하는 문법:

- 제목 `#` ~ `######`
- 문단, 줄바꿈
- 굵게 `**`, 기울임 `*`, 취소선 `~~`, 인라인 코드 `` ` ``
- 링크 `[텍스트](url)`, 이미지 `![alt](url)`
- 순서 없는/있는 목록 (한 단계 중첩까지)
- 인용문 `>`
- 코드 블록 ` ``` ` (언어 이름은 `class="language-xxx"`로 붙이되 문법 강조는 하지 않음)
- 수평선 `---`
- 표 (GFM 스타일)

구현 시 주의:

- **XSS 방지**: 본문 텍스트와 코드 블록 내용은 반드시 HTML 이스케이프(`&`, `<`, `>`, `"`, `'`)한 뒤 변환합니다. `javascript:` 링크는 막습니다.
- 코드 블록 안의 내용은 다른 마크다운 규칙을 적용하지 않습니다.
- 외부 링크(`http`로 시작하고 현재 도메인이 아닌 것)는 `target="_blank" rel="noopener noreferrer"`를 붙입니다.
- 이미지에는 `loading="lazy"`를 붙입니다.

## 디자인 원칙

목표는 **깔끔하고 읽기 편한** 블로그입니다. 장식보다 본문 가독성이 우선입니다.

### 타이포그래피

- 본문 폰트: 시스템 폰트 스택 (한글 우선)
  `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", "Segoe UI", sans-serif`
- 코드 폰트: `ui-monospace, "SFMono-Regular", Consolas, "D2Coding", monospace`
- 본문 크기 `1.0625rem`(17px) 전후, 줄 간격 `1.75`, 한글 줄바꿈을 위해 `word-break: keep-all`
- 본문 최대 너비 `70ch` 내외(약 680~720px)로 제한하고 가운데 정렬
- 제목은 본문보다 확실히 크고 굵게, 제목 위 여백을 아래 여백보다 넉넉하게

### 색상과 테마

- 모든 색은 `:root`의 **CSS 변수**로만 정의하고, 컴포넌트에서는 변수만 참조합니다. 하드코딩된 색상값을 쓰지 않습니다.
  - 예: `--color-bg`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-border`, `--color-code-bg`
- 강조색은 하나만 사용합니다 (링크, 포커스, 태그 등).
- 라이트/다크 모두 본문 대비 WCAG AA(4.5:1) 이상을 유지합니다.
- 다크 모드 배경은 순수 검정(`#000`) 대신 약간 밝은 어두운 회색을 씁니다.

### 다크 모드

- 기본값은 사용자 OS 설정(`prefers-color-scheme`)을 따릅니다.
- 헤더의 토글 버튼으로 라이트/다크를 직접 바꿀 수 있고, 선택은 `localStorage`에 저장합니다.
- 테마는 `<html data-theme="light|dark">` 속성으로 적용합니다.
- **새로고침 시 깜빡임(FOUC) 방지**: 테마를 정하는 짧은 인라인 스크립트를 `<head>`에서 CSS보다 먼저 실행합니다.
- `localStorage` 접근은 `try/catch`로 감쌉니다 (사생활 보호 모드 대비).
- 토글 버튼에는 `aria-label`과 현재 상태(`aria-pressed`)를 넣습니다.

### 반응형 / 모바일

- **모바일 우선**으로 작성하고 `min-width` 미디어 쿼리로 넓은 화면을 확장합니다.
- 브레이크포인트: `640px`(태블릿), `1024px`(데스크톱)
- `<meta name="viewport" content="width=device-width, initial-scale=1">` 필수
- 모바일 좌우 여백 최소 `16px`, 가로 스크롤이 생기면 안 됩니다.
  - 긴 코드 블록과 표는 해당 요소 안에서만 가로 스크롤(`overflow-x: auto`)
  - 이미지는 `max-width: 100%; height: auto`
- 터치 대상(버튼, 링크 영역)은 최소 `44×44px`
- 폰트 크기는 `rem` 단위를 사용합니다.

### 접근성

- 시맨틱 태그 사용: `<header>`, `<main>`, `<article>`, `<nav>`, `<footer>`, `<time datetime="...">`
- 키보드 포커스가 보이도록 `:focus-visible` 스타일 유지
- `prefers-reduced-motion`이면 전환 애니메이션을 끕니다.
- 이미지에 alt가 없으면 빈 `alt=""`로 렌더링합니다.

## 코딩 컨벤션

- JavaScript: ES 모듈(`<script type="module">`), `const`/`let`만 사용, 세미콜론 사용, 들여쓰기 2칸
- 함수는 작게 나누고, DOM 조작과 데이터 처리(파싱 등)를 분리합니다. `markdown.js`와 `frontmatter.js`는 DOM에 의존하지 않는 순수 함수로 작성합니다.
- `fetch` 실패 시 사용자에게 보이는 에러 메시지를 렌더링합니다 (콘솔에만 남기지 않음).
- CSS: 클래스명은 소문자-하이픈(`post-card`, `site-header`), `!important` 사용 금지
- 주석과 UI 문구는 한국어로 작성합니다.

## 로컬 실행

`fetch`는 `file://`로 연 페이지에서 동작하지 않으므로 반드시 로컬 서버로 엽니다.

```bash
# Node.js가 있다면 (이 PC에는 설치되어 있음)
npx serve .
# Python이 있다면
python -m http.server 8000
```

터미널에 표시되는 주소(예: http://localhost:3000)를 브라우저에서 엽니다.

VS Code의 Live Server 확장을 써도 됩니다.

## 작업 후 확인 사항

변경 후에는 다음을 확인합니다:

1. 로컬 서버에서 글 목록과 글 상세가 모두 정상 표시되는지
2. 라이트/다크 전환이 되고, 새로고침 후에도 유지되며 깜빡임이 없는지
3. 화면 너비 375px(모바일)에서 가로 스크롤이 생기지 않는지
4. 브라우저 콘솔에 에러가 없는지
