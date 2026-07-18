/**
 * 세션 간 영속화 — "열 때마다 폴더 선택"을 없애는 레이어.
 *
 * - FileSystemDirectoryHandle 은 Chromium 에서 structured clone 가능
 *   → IndexedDB 에 저장해두고 재방문 시 권한만 다시 확인한다.
 * - queryPermission 이 'granted' 면 조용히 자동 연결,
 *   'prompt' 면 사용자 제스처가 필요하므로 "다시 연결" 버튼을 보여준다.
 * - lastMode 로 데모 모드 사용자도 재방문 시 자동 복원한다.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'b-travel-app';
const STORE = 'kv';

type PermissionMode = 'granted' | 'prompt' | 'denied';

interface HandleWithPermission extends FileSystemDirectoryHandle {
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionMode>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionMode>;
}

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE);
    }
  });
}

export async function saveVaultHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await (await db()).put(STORE, handle, 'vaultHandle');
    await (await db()).put(STORE, 'fs', 'lastMode');
  } catch {
    // 영속화 실패는 치명적이지 않다 — 다음 방문에 다시 선택하면 됨
  }
}

export async function saveLastModeDemo(): Promise<void> {
  try {
    await (await db()).put(STORE, 'demo', 'lastMode');
  } catch {
    // ignore
  }
}

export async function clearPersistedVault(): Promise<void> {
  try {
    const d = await db();
    await d.delete(STORE, 'vaultHandle');
    await d.delete(STORE, 'lastMode');
  } catch {
    // ignore
  }
}

export async function getLastMode(): Promise<'fs' | 'demo' | null> {
  try {
    const v = await (await db()).get(STORE, 'lastMode');
    return v === 'fs' || v === 'demo' ? v : null;
  } catch {
    return null;
  }
}

export interface RestoreResult {
  /** granted: 바로 사용 가능 / prompt: 사용자 제스처로 requestPermission 필요 */
  state: 'granted' | 'prompt';
  handle: FileSystemDirectoryHandle;
}

/** 저장된 vault 핸들을 꺼내 권한 상태와 함께 반환. 없거나 거부면 null. */
export async function restoreVaultHandle(): Promise<RestoreResult | null> {
  try {
    const handle = (await (await db()).get(STORE, 'vaultHandle')) as
      | HandleWithPermission
      | undefined;
    if (!handle) return null;
    const perm = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
    if (perm === 'granted') return { state: 'granted', handle };
    if (perm === 'prompt') return { state: 'prompt', handle };
    return null; // denied
  } catch {
    return null;
  }
}

/** 사용자 제스처 안에서 호출 — 저장된 핸들의 권한을 다시 요청한다. */
export async function requestVaultPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  const h = handle as HandleWithPermission;
  try {
    const perm = (await h.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    return perm === 'granted';
  } catch {
    return false;
  }
}

// ---------- GitHub 동기화 설정 (폰의 vault 연계) ----------

export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  /** fine-grained PAT (contents: read/write). 이 디바이스의 localStorage 에만 저장됨. */
  token: string;
}

const GH_KEY = 'btravel.github';

export function loadGithubConfig(): GithubConfig | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GH_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<GithubConfig>;
    if (!c.owner || !c.repo) return null;
    return { owner: c.owner, repo: c.repo, branch: c.branch || 'main', token: c.token || '' };
  } catch {
    return null;
  }
}

export function saveGithubConfig(config: GithubConfig): void {
  localStorage.setItem(GH_KEY, JSON.stringify(config));
}

export function clearGithubConfig(): void {
  localStorage.removeItem(GH_KEY);
}
