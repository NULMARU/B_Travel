/**
 * 폰의 vault 연계 — GitHub contents API 최소 클라이언트.
 *
 * 폰에서는 폴더에 직접 쓸 수 없다 (showDirectoryPicker 데스크탑 전용).
 * 대신 vault 의 동기화 허브인 GitHub repo 에 직접 읽고 쓴다:
 *
 *   폰 (기록)  ──PUT──▶  vault repo  ◀──Obsidian Git / git pull──  데스크탑 vault
 *   폰 (듣기)  ◀─GET──   vault repo
 *
 * 서버 없음. 토큰(fine-grained PAT, contents 권한만)은 이 디바이스의
 * localStorage 에만 산다. public repo 읽기는 토큰 없이도 동작.
 */

import type { GithubConfig } from './persist';

const API = 'https://api.github.com';

function headers(config: GithubConfig): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (config.token) h.Authorization = `Bearer ${config.token}`;
  return h;
}

/** 유니코드 안전 base64. */
function encodeContent(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeContent(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function contentUrl(config: GithubConfig, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${API}/repos/${config.owner}/${config.repo}/contents/${encoded}?ref=${encodeURIComponent(config.branch)}`;
}

export interface RemoteFile {
  text: string;
  sha: string;
}

/** 파일 읽기. 없으면 null. */
export async function ghGetFile(config: GithubConfig, path: string): Promise<RemoteFile | null> {
  const res = await fetch(contentUrl(config, path), { headers: headers(config) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub 읽기 실패 (${res.status}): ${path}`);
  const json = (await res.json()) as { content?: string; sha: string };
  if (typeof json.content !== 'string') throw new Error(`파일이 아닙니다: ${path}`);
  return { text: decodeContent(json.content), sha: json.sha };
}

/** 디렉터리 목록. 없으면 빈 배열. */
export async function ghListDir(
  config: GithubConfig,
  path: string
): Promise<Array<{ name: string; type: 'file' | 'dir' }>> {
  const res = await fetch(contentUrl(config, path), { headers: headers(config) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub 목록 실패 (${res.status}): ${path}`);
  const json = (await res.json()) as Array<{ name: string; type: string }>;
  if (!Array.isArray(json)) return [];
  return json
    .filter((e) => e.type === 'file' || e.type === 'dir')
    .map((e) => ({ name: e.name.normalize('NFC'), type: e.type as 'file' | 'dir' }));
}

/** 파일 생성/갱신. 기존 파일이면 sha 필수. */
export async function ghPutFile(
  config: GithubConfig,
  path: string,
  text: string,
  message: string,
  sha?: string
): Promise<void> {
  if (!config.token) {
    throw new Error('쓰기에는 GitHub 토큰이 필요합니다. 설정에서 연동을 완료해주세요.');
  }
  const body: Record<string, string> = {
    message,
    content: encodeContent(text),
    branch: config.branch
  };
  if (sha) body.sha = sha;
  const res = await fetch(contentUrl(config, path).split('?')[0], {
    method: 'PUT',
    headers: { ...headers(config), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GitHub 쓰기 실패 (${res.status}): ${detail.slice(0, 200)}`);
  }
}

/**
 * 파일 끝에 append (read-modify-write). 파일이 없으면 header + fragment 로 생성.
 * 409(동시 수정 충돌) 시 1회 재시도.
 */
export async function ghAppendFile(
  config: GithubConfig,
  path: string,
  fragment: string,
  message: string,
  headerIfNew: string
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await ghGetFile(config, path);
    const glue = existing && !existing.text.endsWith('\n\n') ? (existing.text.endsWith('\n') ? '\n' : '\n\n') : '';
    const next = existing ? existing.text + glue + fragment : headerIfNew + fragment;
    try {
      await ghPutFile(config, path, next, message, existing?.sha);
      return;
    } catch (e) {
      if (attempt === 0 && e instanceof Error && /409/.test(e.message)) continue;
      throw e;
    }
  }
}

/** 연동 상태 검사 — repo 접근 + (토큰 있으면) 쓰기 권한 여부 추정. */
export async function ghCheck(config: GithubConfig): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${API}/repos/${config.owner}/${config.repo}`, {
      headers: headers(config)
    });
    if (res.status === 404) return { ok: false, detail: 'repo 를 찾을 수 없습니다 (이름 또는 토큰 권한 확인)' };
    if (!res.ok) return { ok: false, detail: `접근 실패 (${res.status})` };
    const json = (await res.json()) as { permissions?: { push?: boolean }; private?: boolean };
    const canPush = json.permissions?.push ?? false;
    return {
      ok: true,
      detail: `연결됨 (${json.private ? 'private' : 'public'}, ${canPush ? '읽기+쓰기' : '읽기 전용'})`
    };
  } catch {
    return { ok: false, detail: '네트워크 오류' };
  }
}
