<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { parseMarkdown, lintGeoFact, type LinterFinding } from '$lib/markdown';
  import { ridesHandle } from '$lib/stores';

  let rdir = $state<FileSystemDirectoryHandle | null>(null);
  ridesHandle.subscribe((v) => (rdir = v));

  // $page.params.id 는 SvelteKit 이 자동 디코드. 한글 폴더명 NFC 정규화.
  let rideId = $state('');
  $effect(() => {
    const raw = $page.params.id ?? '';
    rideId = decodeURIComponent(raw).normalize('NFC');
  });

  type Tab = 'index' | 'field' | 'fact' | 'meta';
  let tab = $state<Tab>('index');

  let indexText = $state<string | null>(null);
  let fieldText = $state<string | null>(null);
  let factText = $state<string | null>(null);
  let metaText = $state<string | null>(null);
  let loading = $state(false);
  let err = $state<string | null>(null);
  let loadVersion = $state(0); // 재로딩 트리거용

  // 6초 타임아웃 — Samsung Internet 등에서 hang 방지
  function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms}ms)`)), ms)
      )
    ]);
  }

  async function tryGetRideDir(
    root: FileSystemDirectoryHandle,
    id: string
  ): Promise<FileSystemDirectoryHandle | null> {
    // 1) 입력한 이름 그대로
    try {
      return await withTimeout(root.getDirectoryHandle(id, { create: false }), 6000, 'getDirectoryHandle');
    } catch (_) {}
    // 2) NFD 정규화로 한 번 더 (macOS 에서 만든 폴더가 NFD 인 경우)
    const nfd = id.normalize('NFD');
    if (nfd !== id) {
      try {
        return await withTimeout(root.getDirectoryHandle(nfd, { create: false }), 6000, 'getDirectoryHandle(NFD)');
      } catch (_) {}
    }
    // 3) 마지막 폴백: 순회하며 정규화 비교 (느리지만 확실)
    try {
      // @ts-expect-error: values() 타입 미포함
      for await (const entry of root.values()) {
        if (entry.kind === 'directory' && entry.name.normalize('NFC') === id) {
          return entry as FileSystemDirectoryHandle;
        }
      }
    } catch (_) {}
    return null;
  }

  async function readFile(
    dir: FileSystemDirectoryHandle,
    name: string
  ): Promise<string | null> {
    try {
      const fh = await withTimeout(dir.getFileHandle(name, { create: false }), 5000, `getFileHandle(${name})`);
      const file = await fh.getFile();
      return await file.text();
    } catch (_) {
      return null;
    }
  }

  async function load() {
    if (!rdir || !rideId) return;
    loading = true;
    err = null;
    indexText = fieldText = factText = metaText = null;

    try {
      const rideDir = await tryGetRideDir(rdir, rideId);
      if (!rideDir) {
        err = `라이딩 폴더를 찾을 수 없습니다: ${rideId}`;
        return;
      }
      // 4개 파일을 병렬로 — 한 파일이 느려도 다른 파일은 진행
      const [a, b, c, d] = await Promise.all([
        readFile(rideDir, 'index.md'),
        readFile(rideDir, 'field-notes.md'),
        readFile(rideDir, 'geo-fact.md'),
        readFile(rideDir, 'meta.yaml')
      ]);
      indexText = a;
      fieldText = b;
      factText = c;
      metaText = d;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // rdir, rideId, loadVersion 변경 시 재로딩
    void loadVersion;
    if (rdir && rideId) load();
  });

  function retry() {
    loadVersion += 1;
  }

  let indexParsed = $derived(indexText ? parseMarkdown(indexText) : null);
  let factParsed = $derived(factText ? parseMarkdown(factText) : null);
  let factFindings = $derived<LinterFinding[]>(factText ? lintGeoFact(factText) : []);
</script>

<section>
  <div class="head">
    <a href={`${base}/rides`} class="back">← 라이딩 목록</a>
    <h1>{rideId}</h1>
  </div>

  {#if !rdir}
    <p>vault 가 선택되지 않았습니다. <a href={`${base}/`}>홈으로</a></p>
  {:else if loading}
    <p>읽는 중…</p>
  {:else if err}
    <div class="alert error">
      <div>{err}</div>
      <button onclick={retry} class="ghost">다시 시도</button>
    </div>
  {:else}
    <nav class="tabs">
      <button class:active={tab === 'index'} onclick={() => (tab = 'index')}>
        본문 (index.md)
        {indexText ? '✓' : '·'}
      </button>
      <button class:active={tab === 'field'} onclick={() => (tab = 'field')}>
        현장 메모 (field-notes.md)
        {fieldText ? '✓' : '·'}
      </button>
      <button class:active={tab === 'fact'} onclick={() => (tab = 'fact')}>
        사실레이어 (geo-fact.md)
        {factText ? '✓' : '·'}
        {#if factFindings.length > 0}
          <span class="badge">{factFindings.length}</span>
        {/if}
      </button>
      <button class:active={tab === 'meta'} onclick={() => (tab = 'meta')}>
        meta.yaml
        {metaText ? '✓' : '·'}
      </button>
    </nav>

    <article class="panel">
      {#if tab === 'index'}
        {#if !indexText}
          <p class="muted">아직 본문이 없습니다.</p>
        {:else if indexParsed}
          <div class="fm">
            <pre>{JSON.stringify(indexParsed.data, null, 2)}</pre>
          </div>
          <div class="md prose">
            {@html indexParsed.html}
          </div>
        {/if}
      {:else if tab === 'field'}
        {#if !fieldText}
          <p class="muted">아직 현장 메모가 없습니다.</p>
        {:else}
          <pre class="raw">{fieldText}</pre>
        {/if}
      {:else if tab === 'fact'}
        {#if !factText}
          <p class="muted">아직 사실레이어가 추출되지 않았습니다.</p>
          <p class="hint">
            Codex 에 <code>prompts/04_사실레이어.md</code> 실행 → 결과를
            <code>geo-fact.md</code> 로 저장 → 이 페이지 새로고침.
          </p>
        {:else if factParsed}
          <div class="linter">
            <h3>
              GEO 린터
              {#if factFindings.length === 0}
                <span class="ok">통과</span>
              {:else}
                <span class="warn">{factFindings.length}건</span>
              {/if}
            </h3>
            {#if factFindings.length > 0}
              <ul>
                {#each factFindings as f}
                  <li class={`finding ${f.level}`}>
                    <span class="rule">{f.rule}</span>
                    <span class="line">L{f.line}</span>
                    <div class="excerpt">{f.excerpt}</div>
                    {#if f.hint}
                      <div class="hint">{f.hint}</div>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
          <div class="md prose">
            {@html factParsed.html}
          </div>
        {/if}
      {:else if tab === 'meta'}
        {#if !metaText}
          <p class="muted">meta.yaml 이 없습니다.</p>
        {:else}
          <pre class="raw">{metaText}</pre>
        {/if}
      {/if}
    </article>
  {/if}
</section>

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
  }
  .back {
    color: var(--text-dim);
    font-size: 13px;
  }
  h1 {
    font-size: 20px;
    margin: 0;
    font-family: var(--font-mono);
    word-break: break-all;
  }
  .tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
    padding-bottom: 0;
  }
  .tabs button {
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 8px 12px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--accent-bright);
  }
  .badge {
    background: var(--warn);
    color: #1b1409;
    border-radius: 999px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: 700;
  }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 22px;
  }
  .fm {
    background: var(--surface-2);
    padding: 8px 10px;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .fm pre {
    margin: 0;
    font-size: 12px;
    color: var(--text-dim);
  }
  .raw {
    background: var(--surface-2);
    padding: 12px;
    border-radius: 6px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--font-mono);
    font-size: 13px;
  }
  .muted {
    color: var(--text-dim);
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
    margin-top: 4px;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  .alert.error {
    background: rgba(226, 97, 91, 0.1);
    border: 1px solid var(--danger);
    color: #f7c4c1;
    padding: 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    align-self: flex-start;
  }
  .ghost:hover {
    color: var(--text);
  }

  .linter {
    background: var(--surface-2);
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .linter h3 {
    margin: 0 0 8px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ok {
    color: var(--accent-bright);
    font-size: 11px;
    padding: 1px 8px;
    background: rgba(43, 178, 129, 0.15);
    border-radius: 999px;
  }
  .warn {
    color: var(--warn);
    font-size: 11px;
    padding: 1px 8px;
    background: rgba(224, 168, 90, 0.15);
    border-radius: 999px;
  }
  .linter ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .finding {
    padding: 6px 8px;
    border-left: 3px solid var(--warn);
    background: var(--surface);
    border-radius: 4px;
    font-size: 13px;
  }
  .finding.error {
    border-left-color: var(--danger);
  }
  .finding .rule {
    font-weight: 600;
    margin-right: 6px;
  }
  .finding .line {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-dim);
  }
  .finding .excerpt {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text);
    margin: 2px 0;
  }
  .finding .hint {
    color: var(--text-dim);
    font-size: 12px;
  }

  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3) {
    margin-top: 1.2em;
  }
  .prose :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
  }
  .prose :global(th),
  .prose :global(td) {
    border: 1px solid var(--border);
    padding: 6px 10px;
    text-align: left;
  }
  .prose :global(blockquote) {
    border-left: 3px solid var(--border);
    color: var(--text-dim);
    margin: 12px 0;
    padding-left: 12px;
  }
  .prose :global(code) {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
</style>
