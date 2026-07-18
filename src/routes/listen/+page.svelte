<script lang="ts">
  import { onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { splitFrontmatter } from '$lib/markdown';
  import {
    isSpeechSupported,
    contentToParagraphs,
    createTtsPlayer,
    type TtsPlayer
  } from '$lib/tts';
  import { ridesHandle } from '$lib/stores';
  import { loadGithubConfig } from '$lib/persist';
  import { ghListDir, ghGetFile } from '$lib/github';
  import { loadDemoVault } from '$lib/demo';
  import { resolveRidesDir } from '$lib/vault';

  let rdir = $state<FileSystemDirectoryHandle | null>(null);
  ridesHandle.subscribe((v) => (rdir = v));
  let gh = $state(loadGithubConfig());

  let supported = $state(true);
  $effect(() => {
    supported = isSpeechSupported();
  });

  interface Episode {
    id: string;
    title: string;
    paragraphs: string[];
  }

  let episodes = $state<Episode[]>([]);
  let source = $state<'vault' | 'github' | 'demo' | null>(null);
  let loading = $state(true);
  let err = $state<string | null>(null);
  let current = $state<Episode | null>(null);

  async function readEpisodeFromDir(
    dir: FileSystemDirectoryHandle,
    id: string
  ): Promise<Episode | null> {
    try {
      const fh = await dir.getFileHandle('index.md', { create: false });
      const text = await (await fh.getFile()).text();
      const { data, content } = splitFrontmatter(text);
      const paragraphs = contentToParagraphs(content);
      if (paragraphs.length === 0) return null;
      return { id, title: typeof data.title === 'string' ? data.title : id, paragraphs };
    } catch {
      return null;
    }
  }

  async function loadFromRidesDir(rides: FileSystemDirectoryHandle): Promise<Episode[]> {
    const ids: string[] = [];
    // @ts-expect-error: values() 타입 미포함
    for await (const e of rides.values()) {
      if (e.kind === 'directory' && /^\d{4}-\d{2}-\d{2}_/.test(e.name.normalize('NFC'))) {
        ids.push(e.name.normalize('NFC'));
      }
    }
    ids.sort().reverse();
    const out: Episode[] = [];
    for (const id of ids.slice(0, 10)) {
      try {
        const dir = await rides.getDirectoryHandle(id, { create: false });
        const ep = await readEpisodeFromDir(dir, id);
        if (ep) out.push(ep);
      } catch {
        // skip
      }
      if (out.length >= 5) break;
    }
    return out;
  }

  async function loadEpisodes() {
    loading = true;
    err = null;
    try {
      if (rdir) {
        episodes = await loadFromRidesDir(rdir);
        source = 'vault';
      } else if (gh) {
        const entries = await ghListDir(gh, 'rides');
        const ids = entries
          .filter((e) => e.type === 'dir' && /^\d{4}-\d{2}-\d{2}_/.test(e.name))
          .map((e) => e.name)
          .sort()
          .reverse();
        const out: Episode[] = [];
        for (const id of ids.slice(0, 10)) {
          const file = await ghGetFile(gh, `rides/${id}/index.md`);
          if (file) {
            const { data, content } = splitFrontmatter(file.text);
            const paragraphs = contentToParagraphs(content);
            if (paragraphs.length > 0) {
              out.push({
                id,
                title: typeof data.title === 'string' ? data.title : id,
                paragraphs
              });
            }
          }
          if (out.length >= 5) break;
        }
        episodes = out;
        source = 'github';
      } else {
        // 폴백: 데모 vault
        const demoRoot = await loadDemoVault(base);
        const rides = await resolveRidesDir(demoRoot);
        episodes = await loadFromRidesDir(rides);
        source = 'demo';
      }
      current = episodes[0] ?? null;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }
  $effect(() => {
    void rdir;
    loadEpisodes();
  });

  // ---------- 플레이어 ----------
  let player: TtsPlayer | null = null;
  let playState = $state<'playing' | 'paused' | 'stopped' | 'done'>('stopped');
  let currentIdx = $state(-1);
  let rate = $state(1.0);

  function buildPlayer(ep: Episode): TtsPlayer {
    player?.stop();
    return createTtsPlayer({
      paragraphs: ep.paragraphs,
      lang: 'ko-KR',
      onParagraph: (i) => (currentIdx = i),
      onStateChange: (s) => {
        playState = s;
        if (s === 'done' || s === 'stopped') currentIdx = -1;
      }
    });
  }

  function onPlay(from = 0) {
    if (!current) return;
    player = buildPlayer(current);
    player.setRate(rate);
    player.play(from);
  }
  function onPauseResume() {
    if (!player) return;
    if (playState === 'playing') player.pause();
    else if (playState === 'paused') player.resume();
  }
  function onStop() {
    player?.stop();
  }
  function onRate(r: number) {
    rate = r;
    player?.setRate(r);
  }
  function selectEpisode(ep: Episode) {
    onStop();
    current = ep;
  }

  onDestroy(() => player?.stop());
</script>

<section class="listen">
  <header>
    <h1>🎧 듣기</h1>
    {#if source}
      <span class="src src-{source}">
        {source === 'vault' ? 'vault' : source === 'github' ? 'vault repo' : '데모'}
      </span>
    {/if}
  </header>

  {#if loading}
    <p class="muted">본문을 찾는 중…</p>
  {:else if err}
    <div class="alert error">{err}</div>
  {:else if !supported}
    <div class="alert error">이 브라우저는 음성 합성을 지원하지 않습니다.</div>
  {:else if episodes.length === 0}
    <div class="empty">
      <p>들을 본문이 아직 없습니다.</p>
      <p class="hint">
        라이딩을 기록하고 데스크탑에서 정리 명령을 실행하면 본문이 생깁니다.
        {#if !gh && !rdir}
          <br /><a href={`${base}/settings`}>GitHub 연동</a>을 하면 폰에서 vault 의 본문을 바로 듣습니다.
        {/if}
      </p>
    </div>
  {:else if current}
    <div class="player">
      <p class="ep-title">{current.title}</p>
      <p class="ep-id">{current.id} · {current.paragraphs.length}개 문단</p>

      <div class="controls">
        {#if playState === 'stopped' || playState === 'done'}
          <button class="play" onclick={() => onPlay(0)}>▶ 재생</button>
        {:else}
          <button class="play" onclick={onPauseResume}>
            {playState === 'playing' ? '⏸ 일시정지' : '▶ 이어서'}
          </button>
          <button class="ghost" onclick={onStop}>⏹</button>
        {/if}
        <div class="rates">
          {#each [0.8, 1.0, 1.2, 1.5] as r}
            <button class:active={rate === r} onclick={() => onRate(r)}>{r}×</button>
          {/each}
        </div>
      </div>

      <ol class="paras">
        {#each current.paragraphs as p, i}
          <li class:now={i === currentIdx}>
            <button onclick={() => onPlay(i)}>{p.length > 90 ? p.slice(0, 90) + '…' : p}</button>
          </li>
        {/each}
      </ol>
    </div>

    {#if episodes.length > 1}
      <div class="others">
        <h2>다른 라이딩</h2>
        <ul>
          {#each episodes as ep (ep.id)}
            {#if ep.id !== current.id}
              <li><button onclick={() => selectEpisode(ep)}>{ep.id}</button></li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</section>

<style>
  .listen {
    display: grid;
    gap: 14px;
    max-width: 480px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  header h1 {
    font-size: 22px;
    margin: 0;
  }
  .src {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .src-vault {
    background: rgba(43, 178, 129, 0.15);
    color: var(--accent-bright);
  }
  .src-github {
    background: rgba(77, 163, 255, 0.15);
    color: #4da3ff;
  }
  .src-demo {
    background: rgba(224, 168, 90, 0.15);
    color: var(--warn);
  }
  .player {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px;
  }
  .ep-title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
  }
  .ep-id {
    margin: 2px 0 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-dim);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .play {
    background: var(--accent);
    color: white;
    border: none;
    padding: 13px 22px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 14px;
  }
  .rates {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
  .rates button {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 6px 9px;
    border-radius: 8px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  .rates button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .paras {
    margin: 0;
    padding: 0 0 0 20px;
    display: grid;
    gap: 2px;
  }
  .paras li.now {
    background: rgba(43, 178, 129, 0.15);
    border-radius: 6px;
  }
  .paras button {
    background: none;
    border: none;
    color: var(--text-dim);
    text-align: left;
    padding: 6px 8px;
    font-size: 13px;
    line-height: 1.5;
    width: 100%;
  }
  .paras li.now button {
    color: var(--accent-bright);
  }
  .others h2 {
    font-size: 13px;
    color: var(--text-dim);
    margin: 0 0 6px;
  }
  .others ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .others button {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-dim);
    border-radius: 8px;
    padding: 9px 12px;
    width: 100%;
    text-align: left;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-dim);
  }
  .hint {
    font-size: 13px;
  }
  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    color: var(--text-dim);
  }
  .alert.error {
    background: rgba(226, 97, 91, 0.1);
    border: 1px solid var(--danger);
    color: #f7c4c1;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
  }
</style>
