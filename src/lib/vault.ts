/**
 * Vault abstraction over the File System Access API.
 *
 * 책임:
 *  - 사용자가 선택한 cre-vault 폴더 핸들을 보관
 *  - rides/* 디렉터리 스캔
 *  - 각 라이딩 폴더의 index.md / meta.yaml / geo-fact.md / GPX / 번역본 존재 여부 파악
 *  - 텍스트 파일 read/write
 *
 * 브라우저 지원:
 *  - Chromium 계열 (Chrome, Edge, Arc, Brave) 정상 동작
 *  - Safari / Firefox 는 showDirectoryPicker 없음 → isSupported() === false
 *    → 폴백 UI(업로드/다운로드)를 따로 안내 (Sprint 2 에서 구현)
 */

import { parse as parseYaml } from 'yaml';
import matter from 'gray-matter';
import type { RideManifest, RideSummary, WorkflowState } from './types';

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * 폴더 선택 다이얼로그를 띄워 vault 루트 핸들을 받는다.
 * 사용자가 cre-vault 폴더(루트) 또는 그 안의 rides/ 를 직접 골라도 동작하도록 처리.
 */
export async function pickVault(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      '이 브라우저는 File System Access API 를 지원하지 않습니다. ' +
        'Chrome, Edge, Arc 등 Chromium 계열 브라우저로 접속해주세요.'
    );
  }
  const handle = await window.showDirectoryPicker!({
    id: 'b-travel-vault',
    mode: 'readwrite',
    startIn: 'documents'
  });
  return handle;
}

/** 폴더 안에서 하위 디렉터리 핸들을 (없으면 null) 반환. */
async function getDir(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await parent.getDirectoryHandle(name, { create: false });
  } catch {
    return null;
  }
}

/** 파일 핸들을 (없으면 null) 반환. */
async function getFile(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemFileHandle | null> {
  try {
    return await dir.getFileHandle(name, { create: false });
  } catch {
    return null;
  }
}

async function readText(dir: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  const fileHandle = await getFile(dir, name);
  if (!fileHandle) return null;
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * 사용자가 선택한 핸들에서 rides/ 디렉터리를 찾는다.
 * - 핸들이 cre-vault 루트인 경우: rides/ 하위로 들어간다.
 * - 핸들이 이미 rides/ 인 경우: 그 자체를 반환.
 */
export async function resolveRidesDir(
  root: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> {
  // 자기 자신이 rides 인지 (이름으로 추정)
  if (root.name === 'rides') return root;
  const rides = await getDir(root, 'rides');
  if (rides) return rides;
  // 일부 사용자는 한 단계 위 폴더를 고를 수도 있다.
  // (예: ~/projects/ 같은) 이런 경우 friendly error.
  throw new Error(
    `선택한 폴더(${root.name})에서 rides/ 를 찾을 수 없습니다. ` +
      `cre-vault 루트(rides/ 가 들어있는 폴더)를 선택해주세요.`
  );
}

/** rides 디렉터리를 훑어 RideSummary 배열을 만든다. 날짜 내림차순. */
export async function listRides(
  ridesDir: FileSystemDirectoryHandle
): Promise<RideSummary[]> {
  const summaries: RideSummary[] = [];

  // FileSystemDirectoryHandle 의 비표준 async iterator
  // (Chromium 에서 동작)
  // @ts-expect-error: values() 가 lib 타입에 빠져있는 경우 대비
  for await (const entry of ridesDir.values()) {
    if (entry.kind !== 'directory') continue;
    const dir = entry as FileSystemDirectoryHandle;
    const summary = await readRideSummary(dir);
    if (summary) summaries.push(summary);
  }

  summaries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return summaries;
}

/** 한 라이딩 폴더에서 요약 정보를 읽는다. 폴더 이름 규약을 못 맞추면 null. */
export async function readRideSummary(
  rideDir: FileSystemDirectoryHandle
): Promise<RideSummary | null> {
  const id = rideDir.name;
  const m = id.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
  if (!m) return null;
  const [, date, name] = m;

  // 우선 meta.yaml 시도
  let region = '한국';
  let status: 'draft' | 'published' = 'draft';
  let workflowProgress = 0;
  let translationLangs: string[] = [];

  const metaText = await readText(rideDir, 'meta.yaml');
  if (metaText) {
    try {
      const meta = parseYaml(metaText) as Partial<RideManifest> & {
        ride?: { region?: string; status?: 'draft' | 'published' };
        workflow?: WorkflowState[];
      };
      if (meta?.ride?.region) region = meta.ride.region;
      if (meta?.ride?.status) status = meta.ride.status;
      if (Array.isArray(meta?.workflow)) {
        const done = meta.workflow.filter((w) => w.status === 'done').length;
        workflowProgress = done / meta.workflow.length;
      }
      if (Array.isArray(meta?.files?.translations)) {
        translationLangs = meta.files.translations
          .map((p) => p.match(/geo-fact\.([a-zA-Z-]+)\.md$/)?.[1])
          .filter((x): x is string => !!x);
      }
    } catch {
      // meta.yaml 파싱 실패 → 무시하고 기본값 사용
    }
  } else {
    // meta.yaml 없으면 index.md frontmatter 시도
    const indexText = await readText(rideDir, 'index.md');
    if (indexText) {
      try {
        const fm = matter(indexText);
        if (typeof fm.data.region === 'string') region = fm.data.region;
        if (fm.data.status === 'published') status = 'published';
      } catch {
        // ignore
      }
    }
  }

  // 파일 존재 여부 점검
  const gpxDir = await getDir(rideDir, 'gpx');
  let hasGpx = false;
  if (gpxDir) {
    // @ts-expect-error: values() 타입
    for await (const f of gpxDir.values()) {
      if (f.kind === 'file' && (f.name.endsWith('.gpx') || f.name.endsWith('.GPX'))) {
        hasGpx = true;
        break;
      }
    }
  }

  const hasFieldNotes = !!(await getFile(rideDir, 'field-notes.md'));
  const factHandle = await getFile(rideDir, 'geo-fact.md');
  let hasFactSheet = false;
  if (factHandle) {
    const text = await (await factHandle.getFile()).text();
    // 템플릿 placeholder ("(채우기 전)") 만 있는 경우는 아직 안 채워진 것으로 간주
    hasFactSheet = !/\(채우기 전\)/.test(text) && text.trim().length > 50;
  }

  // 번역본을 파일명으로 한 번 더 검증
  if (translationLangs.length === 0) {
    // @ts-expect-error: values() 타입
    for await (const f of rideDir.values()) {
      if (f.kind !== 'file') continue;
      const tm = f.name.match(/^geo-fact\.([a-zA-Z-]+)\.md$/);
      if (tm) translationLangs.push(tm[1]);
    }
  }

  // workflow 미설정 시 휴리스틱
  if (workflowProgress === 0) {
    let done = 1; // plan 단계는 폴더 존재로 done
    if (hasFieldNotes) done++;
    if (hasGpx) done++;
    if (hasFactSheet) done++;
    if (translationLangs.length > 0) done++;
    // tts 는 별도 파일 검사
    const ttsDir = await getDir(rideDir, 'tts');
    if (ttsDir) {
      // @ts-expect-error
      for await (const _ of ttsDir.values()) {
        done++;
        break;
      }
    }
    workflowProgress = done / 6;
  }

  return {
    id,
    name,
    date,
    region,
    status,
    hasGpx,
    hasFieldNotes,
    hasFactSheet,
    translationLangs,
    workflowProgress
  };
}

/** 라이딩 폴더 내 한 텍스트 파일을 통째로 읽는다. */
export async function readRideFile(
  ridesDir: FileSystemDirectoryHandle,
  rideId: string,
  fileName: string
): Promise<string | null> {
  const dir = await getDir(ridesDir, rideId);
  if (!dir) return null;
  return await readText(dir, fileName);
}

/** 라이딩 폴더 내 한 텍스트 파일을 덮어쓴다. (없으면 생성) */
export async function writeRideFile(
  ridesDir: FileSystemDirectoryHandle,
  rideId: string,
  fileName: string,
  content: string
): Promise<void> {
  const dir = await ridesDir.getDirectoryHandle(rideId, { create: false });
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
