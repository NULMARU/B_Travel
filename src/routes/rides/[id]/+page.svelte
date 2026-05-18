<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { readRideFile } from '$lib/vault';
  import { parseMarkdown, lintGeoFact, type LinterFinding } from '$lib/markdown';
  import { ridesHandle } from '$lib/stores';

  let rdir = $state<FileSystemDirectoryHandle | null>(null);
  ridesHandle.subscribe((v) => (rdir = v));

  let rideId = $state('');
  $effect(() => {
    rideId = decodeURIComponent($page.params.id ?? '');
  });

  type Tab = 'index' | 'field' | 'fact' | 'meta';
  let tab = $state<Tab>('index');

  let indexText = $state<string | null>(null);
  let fieldText = $state<string | null>(null);
  let factText = $state<string | null>(null);
  let metaText = $state<string | null>(null);
  let loading = $state(false);
  let err = $state<string | null>(null);

  async function load() {
    if (!rdir || !rideId) return;
    loading = true;
    err = null;
    try {
      indexText = await readRideFile(rdir, rideId, 'index.md');
      fieldText = await readRideFile(rdir, rideId, 'field-notes.md');
      factText = await readRideFile(rdir, rideId, 'geo-fact.md');
      metaText = await readRideFile(rdir, rideId, 'meta.yaml');
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (rdir && rideId) load();
  });

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
    <div class="alert error">{err}</div>
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
