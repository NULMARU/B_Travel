# 시작 가이드 — 자전거 카탈로그 v0.1

> 본인 환경 (Mac + Android + Obsidian + GitHub) 기준.
> 처음 1주일 안에 첫 라이딩 1건을 풀 사이클로 돌리는 게 목표.

---

## 사전 준비 (1일차 — 2~3시간)

### 1. Mac 셋업

```bash
# Homebrew (이미 있으면 생략)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 필수 도구
brew install git python node

# Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Codex App: https://developers.openai.com/codex/app 에서 다운로드

# Obsidian: https://obsidian.md 에서 다운로드
```

### 2. Vault 셋업

```bash
# 이 cre 폴더를 vault로 복사
cp -r ~/Downloads/cre ~/cre-vault
cd ~/cre-vault
./setup.sh
```

`setup.sh` 가:
- 필수 도구 확인
- `.obsidian/`, `rides/`, `_publish/` 폴더 초기화
- Python venv + gpxpy, pyyaml 설치
- Git 초기화

### 3. Obsidian 으로 vault 열기

```bash
open -a Obsidian ~/cre-vault
```

처음 열 때 "Open folder as vault" 선택. Obsidian 의 graph view 에서 메모들이 연결되는 게 보일 거예요.

### 4. Android 에 Obsidian 설치 + Git 플러그인

1. Play Store → Obsidian 설치
2. Settings → Community plugins → Browse → **"Obsidian Git"** 설치
3. Plugin 설정에서 GitHub repo URL 입력 + Personal Access Token

이제 휴대폰에서 적은 메모가 자동으로 Mac 으로 동기화됩니다.

### 5. GitHub 저장소

```bash
# GitHub 웹에서 'cre-vault' 라는 private 저장소 생성
# Personal Access Token 생성 (Settings → Developer settings → Tokens)

cd ~/cre-vault
git remote add origin git@github.com:USERNAME/cre-vault.git
git add .
git commit -m "init: cre vault"
git branch -M main
git push -u origin main
```

---

## 첫 라이딩 (1주일 안)

### Day 1 — 라이딩 전

Mac 에서:
```bash
cd ~/cre-vault
./new-ride.sh
# 경로명: 예) 한강-잠실여의도
# 날짜: 오늘
# 지역: 한국
```

`rides/2026-MM-DD_한강-잠실여의도/` 폴더가 생기고 안에 비어있는 템플릿 파일들이 들어옵니다.

### Day 1 — 라이딩 중 (Android)

Obsidian 모바일에서:
1. 동기화 → vault pull
2. `rides/2026-MM-DD_한강-잠실여의도/field-notes.md` 열기
3. 라이딩 중 마이크 버튼 → 음성으로 메모

음성으로 적을 때 형식 (가이드):

```markdown
## 07:30 잠실대교 진입
- 오늘 바람 강함, 동풍
- 자전거길 진입로에서 사이클러 5명 기다림

## 08:15 청담대교
- 첫 사진 스폿. 강 건너 빌딩숲이 안개에 잠겨있음
- 컨디션 좋음, 평속 18km/h 유지

## 08:50 한남대교
- 휴식. 화장실 사용 가능. 자판기 있음.
- 사진 3장 찍음
```

라이딩 중간중간 짧게. 다 적을 필요 없음, 본문 작성 시 회상의 트리거가 됨.

### Day 1 — 라이딩 끝

1. Strava/Komoot/Ride with GPS 등에서 **GPX 파일 export**
2. Android Obsidian → 동기화 push (음성 메모 올림)
3. 집에서 Mac 켜기

### Day 2 — 본문 작성 (Mac, 30~60분)

```bash
cd ~/cre-vault

# GPX 를 폴더에 넣기
cp ~/Downloads/ride.gpx rides/2026-MM-DD_한강-잠실여의도/gpx/

# GPX 파싱
source .venv/bin/activate
python3 scripts/gpx_parse.py rides/2026-MM-DD_한강-잠실여의도/gpx/ride.gpx

# Claude Code 시작
claude
```

Claude 에게:
```
한강-잠실여의도 라이딩 작업 시작.
gpx_facts.yaml 과 field-notes.md 봐줘.
본문 초안을 어떻게 구성할지 의논하자.
```

→ Claude 가 구조 제안 → 너의 확인 → Codex 에게 초안 의뢰서 → Codex 초안 → Claude 다듬음 → `index.md` 완성

### Day 2~3 — 사실 레이어 (Codex App, 30분)

Codex App 에서 `_meta/catalogs/bike-travel/prompts/04_사실레이어.md` 의 프롬프트 실행. 결과는 `geo-fact.md` 에 저장됨.

### Day 3 — 번역 (15분)

Codex 에게 5단계 번역 의뢰. 영문 `geo-fact.en.md` 생성.

### Day 3 — TTS (10분)

Supertonic 으로 `index.md` 한국어 본문을 음성화. `tts/` 폴더에 저장.

### Day 3 — 발행

```bash
# 본문 → 블로그에 복사 (수동 또는 자동화)
# 사실 레이어 → git push 로 GitHub Pages 자동 발행

git add rides/2026-MM-DD_*
git commit -m "ride: 한강-잠실여의도"
git push
```

### Day 4 — 다음 라이딩 준비

라이딩 가기 전 어제 글을 TTS 로 들으면서 출발. 어제의 추억 → 오늘의 동기.

---

## 첫 라이딩 후 — 회고

본인이 채울 것:

- [ ] 음성 입력 흐름이 자연스러웠나? (Android 받아쓰기 정확도)
- [ ] GPX 파싱 결과가 본인의 시계 값과 얼마나 맞았나?
- [ ] geo-fact.md 가 진짜 AI 가 인용할 만한 구조였나?
- [ ] 번역 품질이 그 시장 사용자에게 자연스러웠나?
- [ ] Supertonic TTS 가 라이딩 중 듣기에 편했나?
- [ ] 6단계 흐름이 어디서 막혔나? (가장 중요)

이 회고가 v0.2 의 입력이 됩니다.

---

## 막혔을 때

- 30분 막힘 → Claude 에게 "지금 막혔어, 어디서부터 다시?" 물어보기
- 1시간 막힘 → 일단 임시 우회 (수동으로 그 단계만 처리) + 단계종료 메모에 기록
- 같은 곳에서 2번 막힘 → 그 단계의 프롬프트를 수정 (메타도구의 진화)
