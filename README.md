# B_Travel — 자전거 여행 기록 PWA

> **현장 음성 → 본문(서사) + 사실레이어(GEO) → 다국어 발행 → 라이딩 중 듣기**
> 자전거 여행자의 6단계 라이딩 사이클을 vault 폴더 하나로 관리하는 웹앱.
> [cre 메타도구](docs/QUICK_START.md) 의 첫 도메인.

이 저장소는 SvelteKit 기반 PWA 입니다. 사용자의 라이딩 데이터(`.md`, `.gpx`, 사진, TTS) 는
**전부 사용자 디바이스 안의 vault 폴더에 머뭅니다.** 서버·DB 없음.

## 현재 상태 — Sprint 0 완료

- [x] SvelteKit + Vite + TypeScript + PWA 셋업
- [x] File System Access API 추상화 (`src/lib/vault.ts`)
- [x] GPX 파서 TS 포팅 (`src/lib/gpx.ts`, Python `gpx_parse.py` 와 동일 스키마)
- [x] 기본 라우팅: `/`, `/rides`, `/rides/[id]`, `/settings`
- [x] 라이딩 목록·상세 화면, 사실레이어 GEO 린터
- [ ] Sprint 1: 새 라이딩 생성 · 모바일 음성 메모 · 사진 첨부
- [ ] Sprint 2: GPX 업로드 + 지도 + 마크다운 에디터 + CLI 핸드오프
- [ ] Sprint 3: 번역 탭 + 5단계 워크플로
- [ ] Sprint 4: TTS 큐 + GitHub Pages 발행 자동화

자세한 로드맵은 [docs/DEV_PLAN_v0.1.md](docs/DEV_PLAN_v0.1.md) 참고.

## 빠른 시작

```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버
npm run dev

# 3) Chrome / Edge / Arc 등 Chromium 계열 브라우저에서
#    http://localhost:5173 접속 → "vault 폴더 선택" 클릭
#    → 본인의 cre-vault 루트 폴더 선택
```

> ⚠️ **Safari · Firefox · iOS Safari** 는 File System Access API 미지원이라
> 현재 폴더 선택이 안 됩니다. Sprint 2 에서 업로드/다운로드 폴백을 추가합니다.

## 폴더 규약

웹앱은 [기존 cre-vault](docs/QUICK_START.md) 폴더 규약을 **그대로 따릅니다**.
새 규약을 만들지 않습니다.

```
cre-vault/
├── rides/YYYY-MM-DD_경로명/
│   ├── index.md          ← 본문 (블로그 발행)
│   ├── field-notes.md    ← 현장 음성 메모
│   ├── geo-fact.md       ← 사실 레이어 (GitHub Pages 발행)
│   ├── geo-fact.{lang}.md ← 다국어 번역
│   ├── meta.yaml         ← 메타·워크플로 상태
│   ├── gpx/*.gpx
│   ├── photos/*.jpg
│   └── tts/*.wav
├── _publish/             ← (자동 생성) 발행 빌드 결과
└── scripts/
    └── gpx_parse.py      ← 검증 페어 (TS 포팅의 회귀 기준)
```

## AI 호출 경계

이 웹앱은 **LLM 호출을 직접 하지 않습니다.**
본문 초안 · 사실레이어 추출 · 번역 같은 AI 작업은 기존 워크플로 (Claude Code / Codex CLI) 가
담당합니다. 웹앱은 각 단계마다 "**CLI 에 넘길 컨텍스트와 프롬프트를 한 번에 모아 클립보드로 복사**"
하는 인터페이스 역할입니다.

```
[웹앱]  ──(컨텍스트+프롬프트 묶음)──▶  클립보드
                                          │
                                          ▼
                          [Claude Code / Codex App (데스크탑)]
                                          │
                                결과 .md 저장
                                          │
                                          ▼
                          [웹앱이 파일 변경 감지 → 화면 갱신]
```

## 기술 스택

| 분류 | 선택 |
| --- | --- |
| 프레임워크 | SvelteKit 2 + Svelte 5 (runes) |
| 빌드 / PWA | Vite 5 + `vite-plugin-pwa` |
| 파일 시스템 | File System Access API + 폴백 |
| 마크다운 | `markdown-it` + `gray-matter` |
| GPX | 자체 구현 (`src/lib/gpx.ts`) |
| YAML | `yaml` |
| 캐시 | `idb` |
| 배포 | Cloudflare Pages / GitHub Pages (정적) |

선정 근거는 [DEV_PLAN_v0.1 §5](docs/DEV_PLAN_v0.1.md#5-기술-스택) 참고.

## 디렉터리

```
b-travel-app/
├── src/
│   ├── app.html
│   ├── app.d.ts
│   ├── lib/
│   │   ├── vault.ts        # File System Access API 추상화
│   │   ├── gpx.ts          # GPX 파서 (TS 포팅)
│   │   ├── markdown.ts     # 마크다운 + GEO 린터
│   │   ├── stores.ts       # 전역 상태 (vault 핸들 등)
│   │   └── types.ts
│   └── routes/
│       ├── +layout.svelte
│       ├── +page.svelte           # 홈 (vault 선택)
│       ├── rides/+page.svelte     # 라이딩 목록
│       ├── rides/[id]/+page.svelte # 라이딩 상세 (4탭)
│       └── settings/+page.svelte
├── static/
│   ├── favicon.svg
│   └── manifest.webmanifest        # PWA 매니페스트 (자동 생성)
├── tests/
│   └── gpx.test.ts                  # GPX 파서 스모크 테스트
├── docs/                            # 참고 자료 (계획서, 원본 cre 가이드)
│   ├── DEV_PLAN_v0.1.md
│   ├── QUICK_START.md
│   ├── 04_사실레이어_프롬프트.md
│   └── reference_gpx_parse.py
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

## 라이센스

비공개 (지인 베타 단계).
