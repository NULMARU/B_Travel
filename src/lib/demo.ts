/**
 * 데모 모드 — 읽기 전용 가상 vault.
 *
 * File System Access API 를 지원하지 않는 브라우저(iOS Safari, Firefox,
 * 모바일 전반)에서도 앱 전체를 둘러볼 수 있도록, static/demo/ 에 번들된
 * sample-vault 를 FileSystemDirectoryHandle 처럼 보이는 셔틀로 감싼다.
 *
 * 구현 범위: 앱이 실제로 쓰는 표면만 — kind/name/values()/
 * getDirectoryHandle/getFileHandle/getFile(). 쓰기(createWritable,
 * create:true)는 전부 읽기 전용 오류를 던진다.
 *
 * 데모 데이터 동기화: `npm run sync:demo` 가 sample-vault/ 를
 * static/demo/ 로 복사하고 manifest.json 을 갱신한다.
 */

export const DEMO_READONLY_MESSAGE =
  '데모 모드는 읽기 전용입니다. 데스크탑 Chrome/Edge 에서 내 vault 폴더를 선택하면 저장할 수 있어요.';

class DemoReadonlyError extends Error {
  constructor() {
    super(DEMO_READONLY_MESSAGE);
    this.name = 'NotAllowedError';
  }
}

function notFound(name: string): Error {
  const e = new Error(`파일 또는 폴더를 찾을 수 없습니다: ${name}`);
  e.name = 'NotFoundError';
  return e;
}

class DemoFileHandle {
  readonly kind = 'file' as const;
  constructor(
    readonly name: string,
    private url: string
  ) {}

  async getFile(): Promise<File> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`데모 파일 로드 실패 (${res.status}): ${this.name}`);
    const blob = await res.blob();
    return new File([blob], this.name, { type: blob.type });
  }

  async createWritable(): Promise<never> {
    throw new DemoReadonlyError();
  }
}

class DemoDirectoryHandle {
  readonly kind = 'directory' as const;
  private dirs = new Map<string, DemoDirectoryHandle>();
  private files = new Map<string, DemoFileHandle>();

  constructor(readonly name: string) {}

  /** manifest 의 상대 경로 하나를 트리에 삽입한다. */
  insert(relPath: string, url: string): void {
    const [head, ...rest] = relPath.split('/');
    if (rest.length === 0) {
      this.files.set(head, new DemoFileHandle(head, url));
      return;
    }
    let child = this.dirs.get(head);
    if (!child) {
      child = new DemoDirectoryHandle(head);
      this.dirs.set(head, child);
    }
    child.insert(rest.join('/'), url);
  }

  async *values(): AsyncGenerator<DemoDirectoryHandle | DemoFileHandle> {
    for (const d of this.dirs.values()) yield d;
    for (const f of this.files.values()) yield f;
  }

  async getDirectoryHandle(
    name: string,
    opts?: { create?: boolean }
  ): Promise<DemoDirectoryHandle> {
    const found = this.dirs.get(name) ?? this.dirs.get(name.normalize('NFC'));
    if (found) return found;
    if (opts?.create) throw new DemoReadonlyError();
    throw notFound(name);
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<DemoFileHandle> {
    const found = this.files.get(name) ?? this.files.get(name.normalize('NFC'));
    if (found) return found;
    if (opts?.create) throw new DemoReadonlyError();
    throw notFound(name);
  }

  async removeEntry(): Promise<never> {
    throw new DemoReadonlyError();
  }
}

export interface DemoManifest {
  vault_name: string;
  files: string[]; // 데모 루트 기준 상대 경로 (예: "rides/2026-05-18_한강-잠실여의도/index.md")
}

/**
 * static/demo/manifest.json 을 읽어 가상 vault 루트 핸들을 만든다.
 * 반환 타입은 실제 FileSystemDirectoryHandle 로 캐스팅해 기존 store 에 그대로 흘린다.
 */
export async function loadDemoVault(base: string): Promise<FileSystemDirectoryHandle> {
  const res = await fetch(`${base}/demo/manifest.json`);
  if (!res.ok) throw new Error(`데모 vault 를 불러오지 못했습니다 (${res.status})`);
  const manifest = (await res.json()) as DemoManifest;

  const root = new DemoDirectoryHandle(manifest.vault_name || 'sample-vault');
  for (const rel of manifest.files) {
    const normalized = rel.normalize('NFC');
    root.insert(normalized, `${base}/demo/${encodeURI(rel)}`);
  }
  return root as unknown as FileSystemDirectoryHandle;
}

/** 핸들이 데모 셔틀인지 판별 (쓰기 UI 비활성화용). */
export function isDemoHandle(handle: unknown): boolean {
  return handle instanceof DemoDirectoryHandle;
}
