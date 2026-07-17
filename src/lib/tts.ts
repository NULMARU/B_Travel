/**
 * 6단계 듣기 — 본문을 문단 큐로 읽어주는 SpeechSynthesis 플레이어.
 *
 * 원칙 4: 듣기 대상은 본문(index.md)뿐. 사실레이어는 듣기용이 아니다.
 * Supertonic 등 외부 TTS 로 만든 tts/*.wav 가 있으면 그쪽을 우선 노출하고,
 * 이 플레이어는 폴백이다.
 */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 마크다운 본문 → 읽기 좋은 문단 배열. 헤더는 문단으로 유지, 서식 문자는 제거. */
export function contentToParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) =>
      block
        .replace(/```[\s\S]*?```/g, '') // 코드 블록 제거
        .replace(/^#{1,6}\s*/gm, '') // 헤더 마커
        .replace(/^>\s?/gm, '') // 인용
        .replace(/^\s*[-*]\s+/gm, '') // 불릿
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 이미지
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 링크 → 텍스트
        .replace(/[*_`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((p) => p.length > 0);
}

export interface TtsPlayer {
  play(fromIndex?: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
  readonly paragraphCount: number;
}

export function createTtsPlayer(opts: {
  paragraphs: string[];
  lang?: string;
  onParagraph?: (index: number) => void;
  onStateChange?: (state: 'playing' | 'paused' | 'stopped' | 'done') => void;
}): TtsPlayer {
  if (!isSpeechSupported()) {
    throw new Error('이 브라우저는 음성 합성(SpeechSynthesis)을 지원하지 않습니다.');
  }
  const synth = window.speechSynthesis;
  let rate = 1.0;
  let index = 0;
  let stopped = true;

  function pickVoice(): SpeechSynthesisVoice | null {
    const lang = opts.lang ?? 'ko-KR';
    const voices = synth.getVoices();
    return (
      voices.find((v) => v.lang === lang && v.localService) ??
      voices.find((v) => v.lang === lang) ??
      voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ??
      null
    );
  }

  function speakNext() {
    if (stopped) return;
    if (index >= opts.paragraphs.length) {
      stopped = true;
      opts.onStateChange?.('done');
      return;
    }
    const u = new SpeechSynthesisUtterance(opts.paragraphs[index]);
    u.lang = opts.lang ?? 'ko-KR';
    u.rate = rate;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onstart = () => opts.onParagraph?.(index);
    u.onend = () => {
      index += 1;
      speakNext();
    };
    u.onerror = () => {
      // 한 문단 실패 시 다음 문단으로
      index += 1;
      speakNext();
    };
    synth.speak(u);
  }

  return {
    get paragraphCount() {
      return opts.paragraphs.length;
    },
    play(fromIndex = 0) {
      synth.cancel();
      index = fromIndex;
      stopped = false;
      opts.onStateChange?.('playing');
      speakNext();
    },
    pause() {
      synth.pause();
      opts.onStateChange?.('paused');
    },
    resume() {
      synth.resume();
      opts.onStateChange?.('playing');
    },
    stop() {
      stopped = true;
      synth.cancel();
      opts.onStateChange?.('stopped');
    },
    setRate(r: number) {
      rate = r;
      // 진행 중이면 현재 문단부터 새 속도로 재시작
      if (!stopped) {
        synth.cancel();
        speakNext();
      }
    }
  };
}
