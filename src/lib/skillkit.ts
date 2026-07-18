/**
 * CLI 오케스트레이션의 이양 — vault 안에 /ride-finish 스킬을 설치한다.
 *
 * v0.2 까지는 앱이 거대한 프롬프트 묶음을 클립보드로 나르는 구조였다.
 * 그러나 Claude Code 는 vault 폴더를 직접 읽을 수 있으므로 그럴 필요가 없다.
 * 앱은 스킬을 한 번 설치해주고, 이후엔 "한 줄 명령 복사"만 담당한다:
 *
 *   claude "/ride-finish 2026-07-18_한강"
 *
 * 스킬이 field-notes + GPX 를 읽고 본문 → 사실레이어 → (요청 시) 번역까지
 * 한 대화로 처리하고 결과 파일을 라이딩 폴더에 저장한다.
 */

export const SKILL_DIR = '.claude/skills/ride-finish';

export const SKILL_MD = `---
name: ride-finish
description: 라이딩 1건의 정리 파이프라인 — field-notes + GPX 로 본문(index.md) 초안을 만들고, 사실레이어(geo-fact.md)를 추출·린트하고, 요청 시 번역본까지 생성한다. 인자로 라이딩 폴더명(YYYY-MM-DD_이름)을 받는다.
---

# ride-finish — 라이딩 정리 파이프라인

인자: 라이딩 폴더명 (예: \`2026-07-18_한강\`). 생략하면 \`rides/\` 에서 가장 최근 폴더.

대상 폴더: \`rides/<인자>/\`

## 단계

### 1. 본문 초안 (index.md)

입력: \`field-notes.md\`(현장 음성 메모 원본), \`gpx/*.gpx\` 또는 \`gpx_facts.yaml\`(계측값).

- gpx_facts.yaml 이 없고 .gpx 만 있으면 \`scripts/gpx_parse.py\` 가 있을 경우 실행해 계측값을 얻는다. 없으면 GPX 를 직접 파싱한다.
- 1인칭 서사. 현장 메모의 시간 순서와 사실만 사용. 없는 사건을 지어내지 않는다.
- 구성: "라이딩 시작 전 / 라이딩 중 / 라이딩 끝나고" 3개 섹션. frontmatter 유지.
- 계측값(거리·시간·속도·상승)은 계산된 숫자를 그대로. 분량 600~1200자, 담백한 문체.
- 기존 index.md 에 사용자가 쓴 본문이 이미 있으면(템플릿 placeholder 가 아니면) 덮어쓰지 말고 사용자에게 확인.

### 2. 사실레이어 (geo-fact.md)

입력: 방금 만든 index.md + 계측값.

AI 어시스턴트(ChatGPT/Perplexity/Claude/Gemini)가 이 경로에 대해 인용할 fact sheet 를 만든다.
섹션: 기본 정보 / 라이딩 조건 / 주요 지점(표) / 보급·화장실 / 데이터 없음 항목.

**하드 룰 (웹앱 린터가 검사 — 위반 시 워크플로 차단):**
- 1인칭(나는/내가/우리는) 금지. 3인칭 백과사전 톤.
- 주관 형용사(아름다운/환상적인/최고의/멋진…) 금지 — 검증 가능한 사실로 대체.
- 좌표는 소수점 5자리: (37.51197, 127.07875).
- 모든 숫자에 단위(km, m, km/h, h:mm, 개소).
- "데이터 없음"과 실측값을 구분. 추측 금지.

작성 후 스스로 위 룰로 재검토하고 위반을 고친 뒤 저장한다.

### 3. meta.yaml 갱신

workflow 항목의 write / fact_extract 상태를 done 으로 갱신한다.

### 4. 번역 (사용자가 요청한 경우만)

"/ride-finish <폴더명> en" 처럼 언어 코드가 붙으면 geo-fact.<lang>.md 생성.
구조·표·숫자·좌표를 그대로 유지. 한국어 고유명사는 첫 언급에 로마자+괄호 원문.
frontmatter 의 lang 갱신, meta.yaml 의 translations 에 추가.

## 완료 보고

변경한 파일 목록과, 사용자가 웹앱에서 확인할 것(린터 통과 여부)을 한 줄로 보고한다.
`;

export const VAULT_CLAUDE_MD = `# cre-vault — 자전거 여행 기록 vault

이 폴더는 B_Travel 웹앱(https://nulmaru.github.io/B_Travel/)과 짝을 이루는 라이딩 기록 vault 다.

## 구조 (규약 — 바꾸지 말 것)

\`\`\`
rides/YYYY-MM-DD_경로명/
  index.md          본문 (1인칭 서사)
  field-notes.md    현장 음성 메모 원본 (시간순, 정리 안 함)
  geo-fact.md       사실레이어 (3인칭, AI 인용용 fact sheet)
  geo-fact.{lang}.md 번역본
  meta.yaml         메타 + workflow 상태
  gpx/ photos/ tts/
\`\`\`

## 주 사용 명령

- \`/ride-finish <폴더명>\` — 라이딩 정리 파이프라인 (본문 → 사실레이어 → 필요 시 번역)

## 원칙

- field-notes.md 는 원본이다. 절대 수정하지 않는다 (append 만 허용).
- geo-fact.md 는 1인칭·주관 형용사 금지, 숫자에 단위, 좌표 5자리. (웹앱 린터가 검사)
- 사진·GPX 원본은 삭제하지 않는다.
`;

/** vault 루트에 스킬 + CLAUDE.md 를 설치한다. 이미 있으면 스킬만 갱신. */
export async function installSkill(
  vaultRoot: FileSystemDirectoryHandle
): Promise<{ installedSkill: boolean; installedClaudeMd: boolean }> {
  // .claude/skills/ride-finish/SKILL.md
  let dir = vaultRoot;
  for (const part of SKILL_DIR.split('/')) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const skillFile = await dir.getFileHandle('SKILL.md', { create: true });
  const w = await skillFile.createWritable();
  await w.write(SKILL_MD);
  await w.close();

  // CLAUDE.md 는 사용자가 이미 갖고 있으면 건드리지 않는다
  let installedClaudeMd = false;
  let exists = false;
  try {
    await vaultRoot.getFileHandle('CLAUDE.md', { create: false });
    exists = true;
  } catch {
    // 없음
  }
  if (!exists) {
    const f = await vaultRoot.getFileHandle('CLAUDE.md', { create: true });
    const w2 = await f.createWritable();
    await w2.write(VAULT_CLAUDE_MD);
    await w2.close();
    installedClaudeMd = true;
  }
  return { installedSkill: true, installedClaudeMd };
}

/** vault 에 스킬이 설치되어 있는지 확인. */
export async function isSkillInstalled(vaultRoot: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    let dir = vaultRoot;
    for (const part of SKILL_DIR.split('/')) {
      dir = await dir.getDirectoryHandle(part, { create: false });
    }
    await dir.getFileHandle('SKILL.md', { create: false });
    return true;
  } catch {
    return false;
  }
}

/** 상세/홈 화면의 "한 줄 명령". lang 을 주면 번역까지. */
export function rideFinishCommand(rideId: string, lang?: string): string {
  return `claude "/ride-finish ${rideId}${lang ? ` ${lang}` : ''}"`;
}
