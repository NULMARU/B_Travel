---
title: "B_Travel 웹앱 — 개발계획 v0.1"
date: 2026-05-18
author: EUROPA
status: draft
domain: bike-travel (cre 메타도구 첫 도메인)
scope: PWA + File System Access API, 지인 베타, 전체 6단계 얕게 한 번에
ai_strategy: Claude Code / Codex CLI 유지 — 웹앱은 입력·표시·발행 레이어
---

# B_Travel 웹앱 — 개발계획 v0.1

## 1. 컨셉 한 줄

> **현장 음성 → 본문(서사) + 사실레이어(GEO) → 다국어 발행 → 라이딩 중 듣기**의 6단계 흐름을, 기존 Obsidian vault 구조를 그대로 두고 **웹앱 인터페이스**만 입혀 모바일·데스크탑에서 같은 흐름을 부드럽게 잇는다.

이번 단계의 목표는 "SaaS 가 아니라, 본인과 지인 라이더 5~20명이 각자 자기 vault 를 들고 같은 도구를 쓰는" 단계입니다. AI 호출(본문 초안·사실 추출·번역)은 기존 Claude Code / Codex CLI 에 그대로 맡기고, 웹앱은 그 입출력을 **잘 모아 보여주고 잘 펴 내보내는** 역할에 집중합니다.

## 2. 결정 사항 (이번 라운드에서 합의됨)

| 항목 | 결정 |
| --- | --- |
| 사용자 범위 | 지인 베타 (소규모 다중사용자, 각자 vault) |
| 배포 형태 | PWA + File System Access API + GitHub Pages 정적 발행 |
| MVP 범위 | 전체 6단계를 얕게 한 번에 (한 라이딩을 처음~끝까지 한 번 돌릴 수 있는 최소 기능) |
| AI 호출 | 기존 Claude Code / Codex CLI 유지 (웹앱은 호출 안 함) |

## 3. 아키텍처

### 3.1 두 페르소나, 한 vault

라이딩 사이클은 디바이스가 두 번 바뀝니다.

- **모바일 PWA (현장)** — 음성 메모, 사진, 짧은 위치 핀. iOS Safari 의 PWA 제약을 감안해 "쓰기 최소, 동기화 신뢰"가 원칙.
- **데스크탑 PWA (집)** — 본문 편집, GPX 파싱·지도 표시, 사실레이어 검증, 번역 검수, 발행.

vault 폴더는 한 개입니다. 동기화 허브는 **GitHub repo**. 모바일은 Obsidian Git 또는 PWA 내 GitHub OAuth 둘 중 안정적인 쪽을 선택합니다 (5번 리스크 참고).

### 3.2 데이터 저장 3계층

| 계층 | 용도 |
| --- | --- |
| 사용자 vault 폴더 (File System Access API) | 1차 저장소. 모든 .md, .gpx, photos, tts 가 여기 산다. |
| IndexedDB (idb 래퍼) | 오프라인 캐시, GPX 파싱 결과 캐시, 작성 중인 본문 자동 저장 |
| GitHub repo (사용자 소유, private 또는 부분 public) | 동기화 허브 + 사실레이어 GitHub Pages 발행 소스 |

웹앱은 **서버를 두지 않습니다.** 사용자 계정·DB·과금이 없으므로 정적 호스팅(Vercel/Cloudflare Pages/GitHub Pages 중 택1)만으로 충분합니다.

### 3.3 AI 호출 경계

```
[웹앱]  ──(컨텍스트+프롬프트 한 묶음 생성)──▶  클립보드
                                                  │
                                                  ▼
                              [데스크탑 CLI: Claude Code / Codex App]
                                                  │
                                            결과 .md 저장
                                                  │
                                                  ▼
                              [웹앱이 파일 변경 감지 → 화면 갱신]
```

웹앱은 LLM 호출을 하지 않습니다. 대신 각 단계마다 "**CLI 에 넘길 프롬프트와 컨텍스트를 한 번에 모아 클립보드 복사**" 버튼을 둡니다. 이후 사용자는 터미널·Codex App 에 paste 하고, 생성된 결과 파일을 vault 폴더가 자동으로 받습니다. (확장 옵션: 로컬 헬퍼 데몬 — 5번 리스크의 옵션 B)

## 4. 6단계 → 웹앱 화면 매핑

| 단계 | 화면 | 입력 | 출력 | CLI 핸드오프 |
| --- | --- | --- | --- | --- |
| 1. 계획 | `NewRideDialog` | 경로명·날짜·지역 | `rides/YYYY-MM-DD_경로명/` 폴더 + 템플릿 (현 `new-ride.sh` 포팅) | 없음 |
| 2. 현장 | `FieldCapture` (모바일 우선) | 마이크(Web Speech API), 카메라, 위치 핀 | `field-notes.md` 에 timestamp 자동 append, `photos/` | 없음 |
| 3. 본문 | `RideEditor` | field-notes + GPX + 사진 | `index.md` | "Codex 에 본문 초안 의뢰" |
| 4. 사실레이어 | `FactSheetView` + 린터 | `index.md`, GPX | `geo-fact.md` | "Codex 에 04_사실레이어.md 실행" |
| 5. 번역 | `TranslationTabs` | `geo-fact.md` | `geo-fact.en.md`, `geo-fact.ja.md` 등 | "Codex 에 5단계 번역 의뢰" |
| 6. 듣기 | `TTSQueue` | `index.md` 본문 | `tts/*.wav` 큐, 다음 라이딩 전 모바일에서 재생 | Supertonic 외부 호출 (또는 SpeechSynthesis 폴백) |

### 4.1 단계별 핵심 디테일

**3단계 RideEditor 가 가장 무겁다.** 좌측에 field-notes·GPX 요약·사진 그리드, 우측에 마크다운 에디터. GPX 파싱 결과(거리·고도·이동시간·평균속도·경로형태)는 사이드바에 항상 노출. MapLibre GL 로 트랙 폴리라인 표시. 사진은 EXIF 시간으로 GPX 트랙 위에 자동 핀.

**4단계 FactSheetView 의 린터가 품질의 핵심이다.** Codex 가 만든 `geo-fact.md` 를 그대로 받아 다음을 자동 검사:

- 1인칭 표현(`나는`, `내가`, `우리는`) 0건
- 주관 형용사(`아름다운`, `환상적인`, `최고의` 등) 0건
- 좌표 소수점 5자리 정밀도
- 모든 숫자 단위 표기 (`km`, `m`, `km/h`, `HH:MM`)
- "데이터 없음" vs 실측값 구분

이 린터는 `04_사실레이어_프롬프트.md` 의 완료 조건을 코드화한 것입니다. 통과해야 5단계로 진행.

**6단계 TTSQueue 는 가벼운 큐레이션 도구.** 본문만 TTS 후보로 노출(사실레이어는 듣기용 아님 — 원칙 4). 다음 라이딩 출발 전 "어제 본문 듣기" 한 번에 큐에 추가.

## 5. 기술 스택

### 5.1 선정

| 분류 | 선택 | 이유 |
| --- | --- | --- |
| 프레임워크 | **SvelteKit** (static adapter) | 빌드 결과 작음, PWA 친화, 컴포넌트 가벼움. 정적 호스팅과 잘 맞음. |
| PWA | `vite-plugin-pwa` (Workbox) | 표준. 오프라인 셸과 캐시 전략 자동. |
| 파일 시스템 | File System Access API + 폴백 | Chromium 우선. Safari/Firefox 는 폴더 업로드/다운로드 폴백. |
| 캐시 | `idb` (IndexedDB 래퍼) | 작성 중 본문 자동 저장, GPX 파싱 결과 캐시. |
| 마크다운 에디터 | CodeMirror 6 | 가볍고 확장 쉬움. 모바일 입력 지원. |
| 마크다운 렌더 | `markdown-it` + `gray-matter` | frontmatter 분리 표준. |
| GPX 파싱 | 자체 구현 (TS 포팅) | 현 `gpx_parse.py` 알고리즘 그대로 TypeScript 화. 라이브러리 의존 0. |
| 지도 | MapLibre GL + OSM 타일 | 무료, 토큰 불필요. |
| 음성 입력 | Web Speech API | 브라우저 내장, 한국어 받아쓰기 양호. |
| 사진 EXIF | `exifr` | 좌표·촬영시각 추출. |
| TTS 폴백 | Web Speech Synthesis API | Supertonic 미설치 사용자용 임시 음성. |
| Git 동기화 | `isomorphic-git` (옵션) | 웹앱 안에서 commit/push. 도입 여부는 Sprint 4 에서 결정. |
| 배포 | Cloudflare Pages (또는 GitHub Pages) | 무료, CDN, PWA 친화. |

### 5.2 의도적으로 안 쓴 것

- 백엔드 프레임워크(Next.js API, Supabase 등) — 1단계에서는 필요 없음. 늘어나는 책임 회피.
- 자체 인증 — GitHub OAuth 하나로 끝. 비밀번호 저장 안 함.
- 자체 LLM 호출 — 의도적. AI 비용·키 관리·환각 책임을 웹앱에 끌어들이지 않음.

## 6. 개발 로드맵 (Sprint 단위)

"전체 6단계 얕게 한 번에" 전략을 ~6주에 걸쳐 분해. 각 스프린트 끝에는 **본인의 실제 라이딩 1건이 그 단계까지 끝나는지** 검증.

### Sprint 0 — 셋업 (1주)

- SvelteKit + Vite + TypeScript + PWA 플러그인 세팅
- File System Access API 추상화 레이어 (`vault.ts`): 폴더 선택, 디렉토리/파일 read·write·watch, 폴백 포함
- 기본 라우팅: `/`, `/rides`, `/rides/:id`, `/settings`
- vault 폴더 선택 후 `rides/*` 디렉토리 스캔 → ride 목록 출력
- **완료 기준**: 기존 vault 의 라이딩 1건을 웹앱이 읽어 목록·기본 정보를 표시할 수 있다.

### Sprint 1 — 계획 + 현장 캡처 (1주)

- `NewRideDialog`: `new-ride.sh` 와 동일한 폴더·템플릿 생성 (frontmatter 포함)
- 모바일 PWA 설치 흐름 검증 (Android Chrome 우선)
- `FieldCapture`: 마이크 → Web Speech API → 자동 timestamp + 텍스트 append
- 카메라 → 사진 저장 + EXIF 보존
- **완료 기준**: 본인이 한 라이딩 1건을 폰에서 새로 만들고, 음성 메모 3건과 사진 5장을 vault 에 남길 수 있다.

### Sprint 2 — 본문 작성 + GPX (1.5주)

- GPX 업로드/드롭 → 클라이언트 파싱 → `gpx_facts.yaml` 저장 (Python 결과와 동일 스키마)
- MapLibre 로 트랙 폴리라인 + 사진 핀 표시
- CodeMirror 에디터 + frontmatter 사이드 패널
- 좌측: field-notes + GPX 요약 + 사진 그리드 / 우측: 본문 에디터
- "Codex 본문 초안 의뢰" 버튼 → 컨텍스트 묶어 클립보드 복사
- **완료 기준**: GPX 업로드 → 본문 초안 의뢰 → CLI 결과 받아 `index.md` 발행 가능 상태까지 다듬을 수 있다.

### Sprint 3 — 사실레이어 + 번역 (1주)

- `FactSheetView` + 린터 (1인칭/형용사/단위/좌표 정밀도 자동 체크)
- "Codex 에 04_사실레이어.md 실행" 핸드오프 버튼
- 번역 탭 UI: 언어별 `.{lang}.md` 자동 인식
- **완료 기준**: 1건의 `geo-fact.md` + `geo-fact.en.md` 가 린터 통과한 상태로 vault 에 저장된다.

### Sprint 4 — TTS + 발행 (1주)

- `TTSQueue`: 본문 → 외부 Supertonic 호출 흐름 안내, 또는 Web Speech Synthesis 임시 음원
- GitHub OAuth → 사실레이어 폴더만 발행 repo 에 push (isomorphic-git 또는 GitHub REST API)
- `_publish/llms.txt` 자동 빌드 (PUBLISH_GUIDE.md 흐름 자동화)
- 블로그용 본문 미리보기 (HTML 변환) — 수동 복붙용
- **완료 기준**: 라이딩 1건이 vault → 사실레이어 GitHub Pages 까지 자동 발행되고, 본문은 한 클릭 복사로 블로그에 옮길 수 있다.

### Sprint 5 — 지인 베타 (계속)

- 3~5명 라이더 초대, 각자 vault 셋업 가이드
- 첫 라이딩 1건씩 풀 사이클 → 회고 수집
- 자주 빠진 단계의 UI 보강
- v0.2 로드맵 수립 (메타도구 패턴 추출 포함)

## 7. 리스크·미해결 결정

### 7.1 iOS Safari 의 PWA 제약

iOS Safari 는 File System Access API 미지원·백그라운드 제약 강함. 베타 사용자에 iPhone 사용자가 많으면 큰 제약입니다.

- 옵션 A (권장): iOS 는 **Obsidian Git 모바일** 그대로 + 데스크탑 웹앱. 모바일 PWA 는 Android Chrome 우선.
- 옵션 B: PWA 안에서 사진/음성을 IndexedDB 에 임시 저장 후 데스크탑에서 vault 에 머지. (복잡)

**미결**: 베타 5~20 명 중 iOS 비율 확인 필요.

### 7.2 라이딩 중 GPS 트랙 기록

PWA 가 자전거 1~5시간 백그라운드 GPS 를 안정적으로 기록하기 어렵습니다. Strava/Komoot/Ride with GPS 의 GPX export 흐름을 유지하는 게 가장 안전합니다. 웹앱은 "GPX 받기" 만 잘 하면 됨.

### 7.3 AI CLI 분리의 UX

"버튼 → 클립보드 → 터미널 paste"가 단계가 많습니다. 대안:

- 옵션 A: 현 흐름 유지 + 클립보드 + "터미널에서 `claude` 실행" 가이드 표시
- 옵션 B: vault 안에 작은 Node 헬퍼 데몬 (`scripts/cre-helper.mjs`) 을 두고 웹앱이 `http://localhost:PORT` 로 호출. CLI 트리거를 한 클릭으로.

**미결**: Sprint 2 끝나고 본인이 직접 한 사이클 돌려본 후 결정.

### 7.4 지인 베타 동기화 모델

각자 자기 GitHub repo 를 갖는다는 가정인데, 발행 사이트는 어떻게 갈지:

- 모두 같은 `cre-publish` repo 의 `rides/{user}/` 하위 폴더에 push (공동)
- 각자 자기 GitHub Pages (분산)

**미결**: 베타 시작 전 결정 필요. "한 사이트, 라이더별 폴더"가 GEO 효과는 좋고, "각자 사이트"는 자율성·소유권이 좋음.

### 7.5 사진 저장 위치

photos/ 가 vault 안에 살면 git repo 가 무거워집니다. Git LFS 또는 별도 CDN(Cloudflare R2 등) 고려. **미결**: 첫 10건 라이딩 용량 측정 후 판단.

### 7.6 베타 사용자 인증

웹앱은 인증 없이 동작 가능(폴더 선택만 하면 됨). 다만 발행 사이트에 라이더별 페이지가 생기면 누가 자기 페이지인지 표식은 필요. GitHub OAuth 하나로 일관.

## 8. 다음 단계 (실행)

1. 이 계획을 본인이 읽고 결정 보류 4건(7.1, 7.3, 7.4, 7.5) 중 최소 7.1 은 베타 후보 디바이스 분포로 확정
2. Sprint 0 시작: 새 git repo `b-travel-app` 초기화, SvelteKit + PWA 보일러플레이트 생성
3. 동시에 본인의 첫 라이딩 1건을 기존 vault + CLI 흐름으로 끝까지 돌려서 — 웹앱 없이 — "어디가 가장 답답한지" 1차 기록. 이게 Sprint 1~2 의 UI 우선순위가 됨.

## 부록 A — 폴더 규약 (변경 없음, 명시 차원)

웹앱은 기존 vault 규약을 **그대로 따른다**. 새 규약을 만들지 않는다.

```
cre-vault/
├── rides/YYYY-MM-DD_경로명/
│   ├── index.md          ← 본문
│   ├── field-notes.md    ← 음성 메모 원본
│   ├── geo-fact.md       ← 사실 레이어
│   ├── geo-fact.{lang}.md
│   ├── meta.yaml         ← 라이딩 메타·워크플로 상태
│   ├── gpx/
│   ├── photos/
│   └── tts/
├── _publish/             ← 빌드 결과 (웹앱이 자동 생성)
└── scripts/
    └── gpx_parse.py      ← TypeScript 포팅과 같은 결과를 내야 함 (검증 기준)
```

## 부록 B — 검증 페어 (회귀 방지)

같은 GPX 1건에 대해 다음 두 결과가 **동일**해야 함:

- `python3 scripts/gpx_parse.py rides/.../gpx/ride.gpx` 출력
- 웹앱이 같은 GPX 를 업로드해 계산한 `gpx_facts.yaml`

차이가 나면 웹앱의 TS 포팅이 틀린 것. 회귀 테스트로 고정.
