/**
 * CLI 핸드오프 — 각 단계에서 Claude Code / Codex CLI 에 붙여넣을
 * "프롬프트 + 컨텍스트 한 묶음"을 만든다.
 *
 * 원칙 (DEV_PLAN §AI 호출 경계): 웹앱은 LLM 을 직접 호출하지 않는다.
 * 묶음 규격: [역할 선언 + 출력 파일 + 완료 조건] --- [컨텍스트 …]
 */

const OUTPUT_RULES = `출력 규칙:
- 결과는 지정된 파일에 저장한다 (현재 라이딩 폴더 기준 상대 경로).
- 파일 저장 외의 다른 부수 작업은 하지 않는다.
- frontmatter 는 기존 파일의 것을 유지·갱신한다.`;

function section(title: string, body: string | null | undefined): string {
  if (!body || !body.trim()) return `### ${title}\n\n(없음)\n`;
  return `### ${title}\n\n\`\`\`\n${body.trim()}\n\`\`\`\n`;
}

/** 3단계 — field-notes + GPX facts 로 본문(index.md) 초안 의뢰. */
export function buildDraftPrompt(ctx: {
  rideId: string;
  fieldNotes: string | null;
  gpxFactsYaml: string | null;
  indexMd: string | null;
}): string {
  return `너는 자전거 여행 작가의 보조 작가다. 아래 현장 메모(음성 받아쓰기 원본)와
GPX 계측값을 바탕으로, 라이딩 폴더 \`rides/${ctx.rideId}/\` 의 \`index.md\` 본문 초안을 작성하라.

작성 지침:
- 1인칭 서사. 현장 메모의 시간 순서와 사실만 사용하고, 없는 사건을 지어내지 않는다.
- 구성: "라이딩 시작 전 / 라이딩 중 / 라이딩 끝나고" 3개 섹션 (기존 템플릿 유지).
- 계측값(거리·시간·속도·상승)은 GPX facts 의 숫자를 그대로 쓴다. 반올림 임의 변경 금지.
- 문체: 담백하게. 과장 형용사 남발 금지.
- 분량: 600~1200자.

${OUTPUT_RULES}
- 출력 파일: ./index.md (본문 섹션만 갱신, frontmatter 유지)

완료 조건: index.md 의 세 섹션이 현장 메모의 모든 시간대를 반영하고, 숫자가 GPX facts 와 일치한다.

---

${section('현장 메모 (field-notes.md)', ctx.fieldNotes)}
${section('GPX 계측값 (gpx_facts.yaml)', ctx.gpxFactsYaml)}
${section('현재 index.md (템플릿/기존 본문)', ctx.indexMd)}`;
}

/** 4단계 — 사실레이어(geo-fact.md) 추출 의뢰. docs/04_사실레이어_프롬프트.md 의 핵심 규격. */
export function buildFactPrompt(ctx: {
  rideId: string;
  indexMd: string | null;
  gpxFactsYaml: string | null;
}): string {
  return `You are extracting a structured "fact layer" from a Korean cyclist's first-person
travel post, for ride folder \`rides/${ctx.rideId}/\`. The fact layer is designed to be
cited by AI assistants (ChatGPT, Perplexity, Claude, Gemini) when users ask about this route.

Task:
1) Use the GPX measurements below as ground truth (do NOT recompute or invent numbers).
2) Extract verifiable named entities from the post: places, bridges, parks, cafés,
   landmarks, trail names — with coordinates when derivable, and distance-from-start (km).
3) Extract practical facts: best season/time, difficulty (from gain per km), bike type,
   restroom/resupply points, surface, traffic.
4) Write the result to ./geo-fact.md with sections:
   기본 정보 (Basic Facts) / 라이딩 조건 (Riding Conditions) / 주요 지점 (Key Waypoints, 표) /
   보급·화장실 (Facilities) / 데이터 없음 항목 (Data Not Available).

Hard rules (the web app lints these — violations block the workflow):
- NO first-person (나는/내가/우리는). Third-person encyclopedic tone only.
- NO subjective adjectives (아름다운/환상적인/최고의/멋진 …). Replace with verifiable facts.
- Coordinates to 5 decimal places: (37.51197, 127.07875).
- Every number carries a unit (km, m, km/h, h:mm, 개소).
- Distinguish "데이터 없음" from measured values — never guess.

${OUTPUT_RULES}
- 출력 파일: ./geo-fact.md

---

${section('본문 (index.md)', ctx.indexMd)}
${section('GPX 계측값 (gpx_facts.yaml)', ctx.gpxFactsYaml)}`;
}

/** 5단계 — 사실레이어 번역 의뢰. */
export function buildTranslatePrompt(ctx: {
  rideId: string;
  factMd: string | null;
  langCode: string;
  langLabel: string;
}): string {
  return `Translate the following cycling route fact sheet (Korean) into ${ctx.langLabel}.
Ride folder: \`rides/${ctx.rideId}/\`.

Rules:
- Preserve the exact markdown structure, tables, and all numbers/units/coordinates verbatim.
- Proper nouns: romanize Korean place names on first mention with the Korean in parentheses,
  e.g. "Jamsil Bridge (잠실대교)".
- Keep the encyclopedic third-person tone. No embellishment.
- Update frontmatter: lang: ${ctx.langCode}, and add "> Translated from: ./geo-fact.md".

${OUTPUT_RULES}
- 출력 파일: ./geo-fact.${ctx.langCode}.md

---

${section('원본 사실레이어 (geo-fact.md)', ctx.factMd)}`;
}

export const TRANSLATE_LANGS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'zh', label: '中文 (Chinese)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fr', label: 'Français (French)' }
];

/** 클립보드 복사 헬퍼. 성공 여부 반환. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
