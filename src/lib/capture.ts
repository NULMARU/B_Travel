/**
 * 현장 캡처 — 음성 받아쓰기 + 위치 핀 + 포켓 모드.
 *
 * 발견 사항: showDirectoryPicker 는 데스크탑 Chromium 전용이라
 * "폰에서 vault 폴더에 직접 쓰기"는 어떤 모바일 브라우저에서도 불가능하다.
 * 그래서 이원화한다:
 *   - vault 쓰기 가능(데스크탑): field-notes.md 에 직접 append
 *   - 그 외(폰 전부, 데모 모드): IndexedDB "포켓"에 보관 → 텍스트 복사/다운로드로
 *     데스크탑에서 vault 에 머지
 */

import { openDB, type IDBPDatabase } from 'idb';

/** 포켓에 쌓이는 메모 한 건. */
export interface PocketNote {
  id: string; // `${rideId}:${epoch}`
  rideId: string;
  createdAt: number; // epoch ms
  hhmm: string; // "07:30"
  text: string;
  lat?: number;
  lng?: number;
}

// ---------- Web Speech API (받아쓰기) ----------

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechResultEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export function isDictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface DictationSession {
  stop(): void;
}

/**
 * 받아쓰기 세션 시작.
 *
 * 중복 방지 설계: 모바일 Chrome 은 같은 final 결과를 여러 이벤트에 걸쳐
 * 다시 보내는 일이 흔하다 (resultIndex 신뢰 불가). 그래서 "확정될 때마다
 * append"하지 않고, 매 이벤트마다 results 전체를 인덱스 기준으로 재조립해
 * 세션 누적 전체 텍스트를 onUpdate 로 넘긴다. 브라우저가 세션을 임의
 * 종료하면 지금까지를 접어두고(committed) 새 세그먼트로 자동 재시작한다.
 */
export function startDictation(opts: {
  lang?: string;
  /** (중복 제거된) 세션 누적 확정 텍스트 전체 + 진행 중 텍스트 */
  onUpdate: (finalText: string, interim: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}): DictationSession {
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) throw new Error('이 브라우저는 음성 받아쓰기(Web Speech API)를 지원하지 않습니다.');

  const rec = new Ctor();
  rec.lang = opts.lang ?? 'ko-KR';
  rec.continuous = true;
  rec.interimResults = true;

  let stopped = false;
  let committed = ''; // 재시작 이전 세그먼트들의 확정 텍스트
  let finals: string[] = []; // 현재 세그먼트: results 인덱스 → 확정 텍스트

  function currentFinalText(): string {
    const seg = finals.filter(Boolean).join('\n');
    if (committed && seg) return `${committed}\n${seg}`;
    return committed + seg;
  }

  rec.onresult = (ev) => {
    let interim = '';
    // resultIndex 를 믿지 않고 전체를 다시 읽는다 — i 가 같으면 같은 발화이므로
    // 재전송이 와도 finals[i] 를 덮어쓸 뿐 중복되지 않는다.
    for (let i = 0; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) {
        finals[i] = r[0].transcript.trim();
      } else {
        interim += r[0].transcript;
      }
    }
    opts.onUpdate(currentFinalText(), interim.trim());
  };
  rec.onerror = (ev) => {
    const code = ev.error ?? 'unknown';
    // no-speech 는 일상적 — 조용히 무시하고 onend 의 재시작에 맡긴다
    if (code !== 'no-speech' && opts.onError) {
      const msg =
        code === 'not-allowed'
          ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.'
          : `받아쓰기 오류: ${code}`;
      opts.onError(msg);
      stopped = true;
    }
  };
  rec.onend = () => {
    // 브라우저가 세션을 임의 종료하는 경우: 세그먼트를 접고 자동 재시작
    if (!stopped) {
      committed = currentFinalText();
      finals = [];
      try {
        rec.start();
        return;
      } catch {
        // 재시작 실패 → 종료 처리
      }
    }
    opts.onEnd?.();
  };

  rec.start();
  return {
    stop() {
      stopped = true;
      rec.stop();
    }
  };
}

// ---------- 위치 핀 ----------

export function getLocationPin(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 위치 정보를 지원하지 않습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          // 사실레이어 규약과 같은 소수점 5자리
          lat: Math.round(pos.coords.latitude * 1e5) / 1e5,
          lng: Math.round(pos.coords.longitude * 1e5) / 1e5
        }),
      (e) => reject(new Error(`위치를 가져오지 못했습니다: ${e.message}`)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

// ---------- 포켓 (IndexedDB) ----------

const DB_NAME = 'b-travel-pocket';
const STORE = 'notes';

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      const store = d.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('byRide', 'rideId');
    }
  });
}

export async function pocketAdd(note: Omit<PocketNote, 'id'>): Promise<PocketNote> {
  const full: PocketNote = { ...note, id: `${note.rideId}:${note.createdAt}` };
  await (await db()).put(STORE, full);
  return full;
}

export async function pocketList(rideId: string): Promise<PocketNote[]> {
  const all = await (await db()).getAllFromIndex(STORE, 'byRide', rideId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function pocketRemove(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}

export async function pocketClear(rideId: string): Promise<void> {
  const notes = await pocketList(rideId);
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  for (const n of notes) await tx.store.delete(n.id);
  await tx.done;
}

// ---------- field-notes.md 조각 생성 · append ----------

export function nowHHMM(d = new Date()): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

/** 메모 1건 → field-notes.md 규약 조각 (`## HH:MM` + 불릿). */
export function noteToMarkdown(note: Pick<PocketNote, 'hhmm' | 'text' | 'lat' | 'lng'>): string {
  const lines = [`## ${note.hhmm}`, ''];
  for (const sentence of note.text.split(/\n+/)) {
    if (sentence.trim()) lines.push(`- ${sentence.trim()}`);
  }
  if (note.lat !== undefined && note.lng !== undefined) {
    lines.push(`- 📍 (${note.lat.toFixed(5)}, ${note.lng.toFixed(5)})`);
  }
  return lines.join('\n') + '\n';
}

export function notesToMarkdown(notes: PocketNote[]): string {
  return notes.map(noteToMarkdown).join('\n');
}

/** 라이딩 폴더의 field-notes.md 끝에 조각을 붙인다. (없으면 생성) */
export async function appendFieldNotes(
  rideDir: FileSystemDirectoryHandle,
  fragment: string
): Promise<void> {
  let existing = '';
  try {
    const fh = await rideDir.getFileHandle('field-notes.md', { create: false });
    existing = await (await fh.getFile()).text();
  } catch {
    // 파일 없음 — 새로 만든다
  }
  const glue = existing && !existing.endsWith('\n\n') ? (existing.endsWith('\n') ? '\n' : '\n\n') : '';
  const fh = await rideDir.getFileHandle('field-notes.md', { create: true });
  const w = await fh.createWritable();
  await w.write(existing + glue + fragment);
  await w.close();
}
