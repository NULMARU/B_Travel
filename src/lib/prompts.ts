/**
 * CLI 핸드오프 잔여 유틸.
 *
 * v0.2 의 "프롬프트+컨텍스트 묶음 복사"는 v0.3 에서 vault 내 /ride-finish
 * 스킬(src/lib/skillkit.ts)로 대체되었다 — Claude Code 는 vault 폴더를 직접
 * 읽을 수 있으므로 앱이 컨텍스트를 나를 필요가 없다.
 * 여기엔 공용 클립보드 헬퍼와 번역 언어 목록만 남긴다.
 */

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
