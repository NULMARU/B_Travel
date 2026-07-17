<script lang="ts">
  import {
    isDictationSupported,
    startDictation,
    getLocationPin,
    nowHHMM,
    noteToMarkdown,
    notesToMarkdown,
    pocketAdd,
    pocketList,
    pocketRemove,
    pocketClear,
    appendFieldNotes,
    type DictationSession,
    type PocketNote
  } from '$lib/capture';

  let {
    rideDir,
    rideId,
    readonly,
    onSaved
  }: {
    rideDir: FileSystemDirectoryHandle | null;
    rideId: string;
    readonly: boolean;
    onSaved: () => void;
  } = $props();

  // 폰(비 Chromium 데스크탑)에서는 vault 직접 쓰기가 불가 → 포켓 모드
  let canWrite = $derived(!!rideDir && !readonly);

  let dictSupported = $state(true);
  $effect(() => {
    dictSupported = isDictationSupported();
  });

  let session: DictationSession | null = null;
  let listening = $state(false);
  let interim = $state('');
  let draft = $state('');
  let pin = $state<{ lat: number; lng: number } | null>(null);
  let msg = $state<string | null>(null);
  let msgKind = $state<'ok' | 'error'>('ok');
  let busy = $state(false);

  let pocket = $state<PocketNote[]>([]);

  async function refreshPocket() {
    try {
      pocket = await pocketList(rideId);
    } catch {
      pocket = [];
    }
  }
  $effect(() => {
    if (rideId) refreshPocket();
  });

  function toggleListen() {
    if (listening) {
      session?.stop();
      session = null;
      listening = false;
      interim = '';
      return;
    }
    msg = null;
    try {
      session = startDictation({
        onFinal(text) {
          draft = draft ? `${draft}\n${text}` : text;
          interim = '';
        },
        onInterim(text) {
          interim = text;
        },
        onError(m) {
          show(m, 'error');
          listening = false;
        },
        onEnd() {
          listening = false;
          interim = '';
        }
      });
      listening = true;
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function addPin() {
    msg = null;
    try {
      pin = await getLocationPin();
      show(`위치 핀 추가됨: (${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)})`, 'ok');
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  function show(m: string, kind: 'ok' | 'error') {
    msg = m;
    msgKind = kind;
  }

  async function save() {
    if (!draft.trim() && !pin) {
      show('저장할 내용이 없습니다. 받아쓰기하거나 직접 입력하세요.', 'error');
      return;
    }
    busy = true;
    msg = null;
    const note = {
      rideId,
      createdAt: Date.now(),
      hhmm: nowHHMM(),
      text: draft.trim() || '(위치 핀만 기록)',
      lat: pin?.lat,
      lng: pin?.lng
    };
    try {
      if (canWrite && rideDir) {
        await appendFieldNotes(rideDir, '\n' + noteToMarkdown(note));
        show('field-notes.md 에 저장했습니다.', 'ok');
        onSaved();
      } else {
        await pocketAdd(note);
        await refreshPocket();
        show('포켓에 보관했습니다. 데스크탑에서 "전체 복사"로 vault 에 옮기세요.', 'ok');
      }
      draft = '';
      pin = null;
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      busy = false;
    }
  }

  async function copyPocket() {
    try {
      await navigator.clipboard.writeText(notesToMarkdown(pocket));
      show('포켓 메모 전체를 field-notes 형식으로 복사했습니다.', 'ok');
    } catch {
      show('클립보드 복사에 실패했습니다.', 'error');
    }
  }

  function downloadPocket() {
    const blob = new Blob([notesToMarkdown(pocket)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field-notes-${rideId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function removeNote(id: string) {
    await pocketRemove(id);
    await refreshPocket();
  }

  async function clearPocket() {
    await pocketClear(rideId);
    await refreshPocket();
    show('포켓을 비웠습니다.', 'ok');
  }
</script>

<div class="capture">
  <div class="mode-banner">
    {#if canWrite}
      ✍️ 이 디바이스는 vault 에 <strong>직접 저장</strong>합니다 (field-notes.md append).
    {:else}
      📦 <strong>포켓 모드</strong> — 이 디바이스(폰/데모)는 vault 폴더에 쓸 수 없어요.
      메모는 이 기기 안(IndexedDB)에 보관되고, 데스크탑에서 복사/다운로드로 옮깁니다.
    {/if}
  </div>

  <div class="input-row">
    {#if dictSupported}
      <button class={listening ? 'danger' : 'primary'} onclick={toggleListen}>
        {listening ? '⏹ 받아쓰기 중지' : '🎙 음성 받아쓰기'}
      </button>
    {:else}
      <span class="hint">이 브라우저는 음성 받아쓰기를 지원하지 않아요. 직접 입력하세요.</span>
    {/if}
    <button class="ghost" onclick={addPin}>📍 위치 핀</button>
  </div>

  {#if listening}
    <div class="listening">
      듣는 중… <em>{interim || '말씀하세요'}</em>
    </div>
  {/if}

  <textarea
    bind:value={draft}
    rows="5"
    placeholder="받아쓰기 결과가 여기 쌓입니다. 직접 입력·수정도 가능."
  ></textarea>

  {#if pin}
    <div class="pin-chip">📍 ({pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}) <button class="x" onclick={() => (pin = null)}>×</button></div>
  {/if}

  <div class="input-row">
    <button class="primary" onclick={save} disabled={busy}>
      {busy ? '저장 중…' : canWrite ? '💾 field-notes 에 저장' : '📦 포켓에 보관'}
    </button>
  </div>

  {#if msg}
    <div class="alert {msgKind}">{msg}</div>
  {/if}

  {#if pocket.length > 0}
    <div class="pocket">
      <div class="pocket-head">
        <h3>포켓 ({pocket.length}건)</h3>
        <div class="pocket-actions">
          <button class="ghost" onclick={copyPocket}>📋 전체 복사</button>
          <button class="ghost" onclick={downloadPocket}>⬇ .md 다운로드</button>
          <button class="ghost" onclick={clearPocket}>🗑 비우기</button>
        </div>
      </div>
      <ul>
        {#each pocket as n (n.id)}
          <li>
            <span class="t">{n.hhmm}</span>
            <span class="txt">{n.text}</span>
            {#if n.lat !== undefined}
              <span class="pin">📍</span>
            {/if}
            <button class="x" onclick={() => removeNote(n.id)} title="삭제">×</button>
          </li>
        {/each}
      </ul>
      {#if canWrite}
        <p class="hint">
          데스크탑 팁: "전체 복사" 후 아래 본문 탭에서 field-notes.md 에 붙여넣거나,
          다운로드한 .md 를 라이딩 폴더로 옮기세요.
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .capture {
    display: grid;
    gap: 12px;
  }
  .mode-banner {
    font-size: 13px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text-dim);
  }
  .input-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .primary:hover {
    background: var(--accent-bright);
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .danger {
    background: var(--danger);
    color: white;
    border: none;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 9px 13px;
    border-radius: 8px;
    font-size: 13px;
  }
  .ghost:hover {
    color: var(--text);
  }
  .listening {
    font-size: 13px;
    color: var(--accent-bright);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.55;
    }
  }
  textarea {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    padding: 10px 12px;
    font: inherit;
    resize: vertical;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent-bright);
  }
  .pin-chip {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--accent-bright);
    display: flex;
    align-items: center;
    gap: 6px;
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
  .pocket {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  .pocket-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pocket-head h3 {
    margin: 0;
    font-size: 14px;
  }
  .pocket-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pocket ul {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .pocket li {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 13px;
    background: var(--surface-2);
    border-radius: 6px;
    padding: 6px 10px;
  }
  .pocket .t {
    font-family: var(--font-mono);
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .pocket .txt {
    flex: 1;
    white-space: pre-wrap;
  }
  .x {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 14px;
    padding: 0 2px;
  }
  .x:hover {
    color: var(--danger);
  }
  .hint {
    color: var(--text-dim);
    font-size: 12px;
    margin: 10px 0 0;
  }
</style>
