/**
 * "다음 할 일" 엔진 — meta.yaml workflow / 파일 존재 여부에서
 * 사용자가 지금 눌러야 할 단 하나의 액션을 계산한다.
 *
 * UI 원칙 (DEV_PLAN v0.3): 화면에 파이프라인을 펼치지 않는다.
 * 상태 머신은 코드가 들고, 사용자에겐 버튼 하나만 보여준다.
 */

import type { RideSummary } from './types';
import { rideFinishCommand } from './skillkit';

export interface NextStep {
  /** 버튼에 쓸 짧은 라벨 */
  label: string;
  /** 부연 한 줄 */
  hint: string;
  /** 어떤 동작인가 */
  kind: 'capture' | 'upload-gpx' | 'run-cli' | 'review-fact' | 'listen' | 'done';
  /** run-cli 일 때 복사할 한 줄 명령 */
  command?: string;
}

export function computeNextStep(ride: RideSummary, opts?: { lintErrors?: number }): NextStep {
  // ② 현장 메모가 없으면 — 기록부터
  if (!ride.hasFieldNotes) {
    return {
      kind: 'capture',
      label: '🎙 현장 메모 남기기',
      hint: '음성 받아쓰기로 라이딩의 재료를 모으세요.'
    };
  }
  // ③ GPX 가 없으면 — 업로드
  if (!ride.hasGpx) {
    return {
      kind: 'upload-gpx',
      label: '📈 GPX 올리기',
      hint: 'Strava · Komoot 에서 export 한 .gpx 를 올리면 계측값이 계산됩니다.'
    };
  }
  // ③→④ 본문/사실레이어가 없으면 — CLI 한 줄
  if (!ride.hasFactSheet) {
    return {
      kind: 'run-cli',
      label: '📋 정리 명령 복사',
      hint: 'vault 폴더 터미널에 붙여넣으면 본문 → 사실레이어까지 한 번에 만듭니다.',
      command: rideFinishCommand(ride.id)
    };
  }
  // ④ 린터 미통과 — 검수
  if ((opts?.lintErrors ?? 0) > 0) {
    return {
      kind: 'review-fact',
      label: `🔍 사실레이어 검수 (${opts?.lintErrors}건)`,
      hint: '린터 지적을 확인하고 정리 명령을 다시 실행하세요.'
    };
  }
  // ⑥ 다 됐으면 — 듣기 (다음 라이딩의 입력)
  return {
    kind: 'listen',
    label: '🎧 본문 듣기',
    hint: '다음 라이딩 출발 전, 이 본문을 들어보세요. 번역·발행은 상세 화면에서.'
  };
}
