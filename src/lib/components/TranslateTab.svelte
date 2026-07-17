<script lang="ts">
  import { parseMarkdown } from '$lib/markdown';
  import { buildTranslatePrompt, copyToClipboard, TRANSLATE_LANGS } from '$lib/prompts';

  let {
    rideDir,
    rideId,
    factText
  }: {
    rideDir: FileSystemDirectoryHandle | null;
    rideId: string;
    factText: string | null;
  } = $props();

  let langs = $state<string[]>([]);
  let current = $state<string | null>(null);
  let currentText = $state<string | null>(null);
  let msg = $state<string | null>(null);
  let msgKind = $state<'ok' | 'error'>('ok');
  let reqLang = $state(TRANSLATE_LANGS[0].code);

  async function scan() {
    if (!rideDir) return;
    const found: string[] = [];
    try {
      // @ts-expect-error: values() 타입 미포함
      for await (const f of rideDir.values()) {
        if (f.kind !== 'file') continue;
        const m = f.name.match(/^geo-fact\.([a-zA-Z-]+)\.md$/);
        if (m) found.push(m[1]);
      }
    } catch {
      // ignore
    }
    found.sort();
    langs = found;
    if (found.length > 0 && (!current || !found.includes(current))) {
      await select(found[0]);
    }
  }

  async function select(lang: string) {
    if (!rideDir) return;
    current = lang;
    try {
      const fh = await rideDir.getFileHandle(`geo-fact.${lang}.md`, { create: false });
      currentText = await (await fh.getFile()).text();
    } catch {
      currentText = null;
    }
  }

  $effect(() => {
    if (rideDir) scan();
  });

  let parsed = $derived(currentText ? parseMarkdown(currentText) : null);
  let missing = $derived(TRANSLATE_LANGS.filter((l) => !langs.includes(l.code)));

  async function copyTranslate() {
    const info = TRANSLATE_LANGS.find((l) => l.code === reqLang);
    if (!info) return;
    const ok = await copyToClipboard(
      buildTranslatePrompt({ rideId, factMd: factText, langCode: info.code, langLabel: info.label })
    );
    msg = ok
      ? `${info.label} 번역 의뢰 묶음을 복사했습니다. CLI 에 붙여넣으면 geo-fact.${info.code}.md 가 생성됩니다.`
      : '클립보드 복사 실패';
    msgKind = ok ? 'ok' : 'error';
  }
</script>

<div class="trans">
  {#if !factText}
    <div class="empty">
      <p>먼저 4단계(사실레이어)를 완료하세요. 번역의 원본은 <code>geo-fact.md</code> 입니다.</p>
    </div>
  {:else}
    <div class="toolbar">
      {#if langs.length > 0}
        <nav class="langs">
          {#each langs as l}
            <button class:active={current === l} onclick={() => select(l)}>{l}</button>
          {/each}
        </nav>
      {/if}
      {#if missing.length > 0}
        <div class="request">
          <select bind:value={reqLang}>
            {#each missing as l}
              <option value={l.code}>{l.label}</option>
            {/each}
          </select>
          <button class="primary" onclick={copyTranslate}>📋 번역 CLI 의뢰</button>
        </div>
      {/if}
    </div>

    {#if msg}
      <div class="alert {msgKind}">{msg}</div>
    {/if}

    {#if langs.length === 0}
      <div class="empty">
        <p>아직 번역본이 없습니다.</p>
        <p class="hint">
          위에서 언어를 고르고 "번역 CLI 의뢰"를 누르면 프롬프트+원본이 클립보드에 담깁니다.
          CLI 가 <code>geo-fact.{'{lang}'}.md</code> 를 저장하면 여기 자동으로 탭이 생깁니다.
        </p>
      </div>
    {:else if parsed}
      <article class="md">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html parsed.html}
      </article>
    {/if}
  {/if}
</div>

<style>
  .trans {
    display: grid;
    gap: 12px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .langs {
    display: flex;
    gap: 4px;
  }
  .langs button {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-family: var(--font-mono);
  }
  .langs button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .request {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  select {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 8px 10px;
    font: inherit;
    font-size: 13px;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 9px 13px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
  }
  .primary:hover {
    background: var(--accent-bright);
  }
  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 24px;
    text-align: center;
    color: var(--text-dim);
  }
  .hint {
    font-size: 13px;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  .md {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 20px;
    overflow-x: auto;
  }
  .md :global(table) {
    border-collapse: collapse;
    font-size: 13px;
  }
  .md :global(td),
  .md :global(th) {
    border: 1px solid var(--border);
    padding: 5px 9px;
  }
  .alert {
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
  }
  .alert.ok {
    background: rgba(43, 178, 129, 0.1);
    border: 1px solid var(--accent);
    color: var(--accent-bright);
  }
  .alert.error {
    background: rgba(226, 97, 91, 0.1);
    border: 1px solid var(--danger);
    color: #f7c4c1;
  }
</style>
