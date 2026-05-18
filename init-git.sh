#!/usr/bin/env bash
# B_Travel — git 초기화 + 첫 푸시 헬퍼.
#
# Cowork 샌드박스 권한 한계로 sandbox 안에서 git init 을 완결하지 못해,
# 사용자가 본인 셸에서 이 스크립트를 한 번 돌리면 됩니다.
#
# 전제:
#   - GitHub 레포(https://github.com/NULMARU/B_Travel.git)는 본인이 이미 비운 상태
#   - 이 폴더에서 실행

set -euo pipefail

cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1) 샌드박스가 남긴 깨진 .git 정리
if [[ -d .git ]]; then
  echo -e "${YELLOW}기존 .git 디렉터리 제거…${NC}"
  rm -rf .git
fi

# 2) zip 아카이브는 .gitignore 에 잡혀있지만, 굳이 워킹트리에서도 빼고 싶으면 주석 해제
# rm -f cre-bike-vault.zip files.zip

# 3) git init + 초기 커밋
echo -e "${YELLOW}git init…${NC}"
git init -b main
git add -A

git -c user.name="EUROPA" -c user.email="nulmaru@gmail.com" \
  commit -m "feat: Sprint 0 — SvelteKit + PWA scaffold, vault + GPX + GEO linter

- SvelteKit 2 + Svelte 5(runes) + Vite + vite-plugin-pwa
- File System Access API 기반 vault 추상화 (listRides, readRideSummary)
- GPX 파서 TS 포팅 (Python gpx_parse.py 와 동일 스키마)
- markdown-it + gray-matter + GEO 린터 (1인칭/주관 형용사/단위 누락)
- 라우팅: 홈(vault 선택) / 라이딩 목록 / 라이딩 상세(4탭) / 설정
- 참고 자료는 docs/ 로 정리"

# 4) 원격 등록 + force push
echo -e "${YELLOW}원격 등록…${NC}"
git remote add origin https://github.com/NULMARU/B_Travel.git || \
  git remote set-url origin https://github.com/NULMARU/B_Travel.git

echo -e "${YELLOW}push (--force) — 레포가 비어있다고 했으니 안전${NC}"
git push -u origin main --force

echo -e "${GREEN}✓ 완료. https://github.com/NULMARU/B_Travel 에서 확인${NC}"
