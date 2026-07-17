<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    isSpeechSupported,
    contentToParagraphs,
    createTtsPlayer,
    type TtsPlayer
  } from '$lib/tts';

  let {
    rideDir,
    indexContent
  }: {
    rideDir: FileSystemDirectoryHandle | null;
    indexContent: string | null; // frontmatter 제거된 본문
  } = $props();

  let supported = $state(true);
  $effect(() => {
    supported = isSpeechSupported();
  });

  let paragraphs = $derived(indexContent ? contentToParagraphs(indexContent) : []);

  let player: TtsPlayer | null = null;
  let playState = $state<'playing' | 'paused' | 'stopped' | 'done'>('stopped');
  let currentIdx = $state(-1);
  let rate = $state(1.0);

  // tts/ 폴더의 외부 TTS 음원 (Supertonic 등)
  let audioFiles = $state<Array<{ name: string; url: string }>>([]);

  async function scanAudio() {
    if (!rideDir) return;
    const found: Array<{ name: string; url: string }> = [];
    try {
      const ttsDir = await rideDir.getDirectoryHandle('tts', { create: false });
      // @ts-expect-error: values() 타입 미포함
      for await (const f of ttsDir.values()) {
        if (f.kind === 'file' && /\.(wav|mp3|m4a|ogg)$/i.test(f.name)) {
          const file = await (f as FileSystemFileHandle).getFile();
          found.push({ name: f.name, url: URL.createObjectURL(file) });
        }
      }
    } catch {
      // tts/ 없음
    }
    found.sort((a, b) => a.name.localeCompare(b.name));
    // 이전 objectURL 정리
    for (const a of audioFiles) URL.revokeObjectURL(a.url);
    audioFiles = found;
  }
  $effect(() => {
    if (rideDir) scanAudio();
  });

  function ensurePlayer(): TtsPlayer {
    if (!player) {
      player = createTtsPlayer({
        paragraphs,
        lang: 'ko-KR',
        onParagraph: (i) => (currentIdx = i),
        onStateChange: (s) => {
          playState = s;
          if (s === 'done' || s === 'stopped') currentIdx = -1;
        }
      });
    }
    return player;
  }

  function onPlay(from = 0) {
    ensurePlayer().play(from);
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

  onDestroy(() => {
    player?.stop();
    for (const a of audioFiles) URL.revokeObjectURL(a.url);
  });
</script>

<div class="listen">
  <p class="principle">
    🎧 듣기 대상은 <strong>본문</strong>뿐입니다 (사실레이어는 듣기용이 아님 — 원칙 4).
    다음 라이딩 출발 전, 어제의 본문을 들어보세요.
  </p>

  {#if audioFiles.length > 0}
    <div class="panel">
      <h3>외부 TTS 음원 (tts/)</h3>
      <ul class="audio-list">
        {#each audioFiles as a (a.name)}
          <li>
            <span class="name">{a.name}</span>
            <audio controls preload="none" src={a.url}></audio>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if !indexContent}
    <div class="empty"><p>본문(index.md)이 아직 없습니다. 3단계에서 본문을 먼저 만드세요.</p></div>
  {:else if !supported}
    <div class="empty">
      <p>이 브라우저는 음성 합성을 지원하지 않습니다. tts/ 폴더의 음원 파일을 이용하세요.</p>
    </div>
  {:else}
    <div class="panel">
      <h3>브라우저 낭독 {audioFiles.length > 0 ? '(폴백)' : ''} <span class="sub">{paragraphs.length}개 문단</span></h3>
      <div class="controls">
        {#if playState === 'stopped' || playState === 'done'}
          <button class="primary" onclick={() => onPlay(0)}>▶ 처음부터 재생</button>
        {:else}
          <button class="primary" onclick={onPauseResume}>
            {playState === 'playing' ? '⏸ 일시정지' : '▶ 이어서'}
          </button>
          <button class="ghost" onclick={onStop}>⏹ 정지</button>
        {/if}
        <div class="rates">
          {#each [0.8, 1.0, 1.2, 1.5] as r}
            <button class:active={rate === r} onclick={() => onRate(r)}>{r}×</button>
          {/each}
        </div>
      </div>

      <ol class="paras">
        {#each paragraphs as p, i}
          <li class:current={i === currentIdx}>
            <button class="para" onclick={() => onPlay(i)} title="여기부터 재생">
              {p.length > 120 ? p.slice(0, 120) + '…' : p}
            </button>
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</div>

<style>
  .listen {
    display: grid;
    gap: 12px;
  }
  .principle {
    margin: 0;
    font-size: 13px;
    color: var(--text-dim);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  .panel h3 {
    margin: 0 0 10px;
    font-size: 14px;
  }
  .sub {
    color: var(--text-dim);
    font-weight: 400;
    font-size: 12px;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 9px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
  }
  .primary:hover {
    background: var(--accent-bright);
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 13px;
    border-radius: 8px;
    font-size: 13px;
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
    padding: 5px 10px;
    border-radius: 6px;
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
    padding: 0 0 0 22px;
    display: grid;
    gap: 4px;
  }
  .paras li {
    border-radius: 6px;
  }
  .paras li.current {
    background: rgba(43, 178, 129, 0.15);
  }
  .paras li.current .para {
    color: var(--accent-bright);
  }
  .para {
    background: none;
    border: none;
    color: var(--text-dim);
    text-align: left;
    padding: 5px 8px;
    font-size: 13px;
    line-height: 1.5;
    width: 100%;
  }
  .para:hover {
    color: var(--text);
  }
  .audio-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .audio-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .audio-list .name {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .audio-list audio {
    height: 34px;
  }
  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 24px;
    text-align: center;
    color: var(--text-dim);
  }
</style>
