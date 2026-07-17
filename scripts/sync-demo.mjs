/**
 * sample-vault/ → static/demo/ 복사 + manifest.json 생성.
 * 데모 모드(src/lib/demo.ts)가 이 manifest 를 읽는다.
 *
 * 사용: npm run sync:demo
 */
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'sample-vault');
const DEST = path.join(root, 'static', 'demo');

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listFiles(path.join(dir, entry.name), rel)));
    } else if (entry.isFile() && !entry.name.startsWith('.')) {
      out.push(rel);
    }
  }
  return out;
}

await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });
await cp(SRC, DEST, { recursive: true });

// 한글 경로는 NFC 로 통일 (macOS 파일시스템은 NFD 를 줄 수 있음)
const files = (await listFiles(DEST)).map((f) => f.normalize('NFC')).sort();
const manifest = { vault_name: 'sample-vault', files };
await writeFile(path.join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`static/demo ← sample-vault 동기화 완료 (${files.length}개 파일)`);
