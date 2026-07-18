<script lang="ts">
  import { base } from '$app/paths';
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
    appendFieldNotes,
    type DictationSession,
    type PocketNote
  } from '$lib/capture';
  import { createRide, fieldNotesTemplate } from '$lib/templates';
  import { ridesHandle, demoMode } from '$lib/stores';
  import { loadGithubConfig } from '$lib/persist';
  import { ghListDir, ghAppendFile } from '$lib/github';

  const today = new Date().toISOString().slice(0, 10);

  let rdir = $state<FileSystemDirectoryHandle | null>(null);
  ridesHandle.subscribe((v) => (rdir = v));
  let isDemo = $state(false);
  demoMode.subscribe((v) => (isDemo = v));

  let gh = $state(loadGithubConfig());

  // 저장 경로 우선순위: 데스크탑 vault 직접 > GitHub repo > 포켓
  let sink = $derived<'vault' | 'github' | 'pocket'>(
    rdir && !isDemo ? 'vault' : gh?.token ? 'github' : 'pocket'
  );

  let dictSupported = $state(true);
  $effect(() => {
    dictSupported = isDictationSupported();
  });

  let session: DictationSession | null = null;
  let listening = $state(false);
  let interim = $state('');
  let draft = $state('');
  let attachPin = $state(true);
  let busy = $state(false);
  let msg = $state<string | null>(null);
  let msgKind = $state<'ok' | 'error'>('ok');

  // 오늘의 라이딩 폴더명 (있으면 그것, 없으면 YYYY-MM-DD_라이딩)
  let todayRideId = $state(`${today}_라이딩`);
  let resolvedFrom = $state<'existing' | 'new'>('new');

  async function resolveTodayRide() {
    try {
      if (sink === 'vault' && rdir) {
        // @ts-expect-error: values() 타입 미포함
        for await (const e of rdir.values()) {
          if (e.kind === 'directory' && e.name.normalize('NFC').startsWith(`${today}_`)) {
            todayRideId = e.name.normalize('NFC');
            resolvedFrom = 'existing';
            return;
          }
        }
      } else if (sink === 'github' && gh) {
        const entries = await ghListDir(gh, 'rides');
        const found = entries.find((e) => e.type === 'dir' && e.name.startsWith(`${today}_`));
        if (found) {
          todayRideId = found.name;
          resolvedFrom = 'existing';
          return;
        }
      }
    } catch {
      // 조회 실패 → 기본 이름 사용
    }
    todayRideId = `${today}_라이딩`;
    resolvedFrom = 'new';
  }
  $effect(() => {
    void sink;
    resolveTodayRide();
  });

  let pocket = $state<PocketNote[]>([]);
  async function refreshPocket() {
    try {
      pocket = await pocketList(todayRideId);
    } catch {
      pocket = [];
    }
  }
  $effect(() => {
    if (todayRideId) refreshPocket();
  });

  function show(m: string, kind: 'ok' | 'error' = 'ok') {
    msg = m;
    msgKind = kind;
  }

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

  async function save() {
    if (!draft.trim()) {
      show('내용이 없습니다. 말하거나 입력한 뒤 저장하세요.', 'error');
      return;
    }
    busy = true;
    msg = null;

    // 위치 핀은 있으면 좋고 없으면 그만 — 실패해도 저장은 계속
    let pin: { lat: number; lng: number } | null = null;
    if (attachPin) {
      try {
        pin = await getLocationPin();
      } catch {
        pin = null;
      }
    }

    const note = {
      rideId: todayRideId,
      createdAt: Date.now(),
      hhmm: nowHHMM(),
      text: draft.trim(),
      lat: pin?.lat,
      lng: pin?.lng
    };
    const fragment = '\n' + noteToMarkdown(note);
    const header = fieldNotesTemplate({
      date: today,
      name: todayRideId.slice(today.length + 1),
      region: '한국'
    });

    try {
      if (sink === 'vault' && rdir) {
        if (resolvedFrom === 'new') {
          await createRide(rdir, { date: today, name: todayRideId.slice(today.length + 1), region: '한국' });
          resolvedFrom = 'existing';
        }
        const rideDir = await rdir.getDirectoryHandle(todayRideId, { create: false });
        await appendFieldNotes(rideDir, fragment);
        show(`vault 의 ${todayRideId}/field-notes.md 에 저장했습니다.`);
      } else if (sink === 'github' && gh) {
        await ghAppendFile(
          gh,
          `rides/${todayRideId}/field-notes.md`,
          fragment,
          `field: 음성 메모 ${note.hhmm} (B_Travel)`,
          header
        );
        show(`vault repo 에 저장했습니다 → rides/${todayRideId}/field-notes.md`);
      } else {
        await pocketAdd(note);
        await refreshPocket();
        show('이 기기 포켓에 보관했습니다. (GitHub 연동을 설정하면 vault 로 바로 저장돼요)');
      }
      draft = '';
    } catch (e) {
      // 온라인 저장 실패 → 포켓 폴백 (기록은 절대 잃지 않는다)
      try {
        await pocketAdd(note);
        await refreshPocket();
        show(
          `저장 실패 → 포켓에 보관했습니다. (${e instanceof Error ? e.message : e})`,
          'error'
        );
        draft = '';
      } catch {
        show(e instanceof Error ? e.message : String(e), 'error');
      }
    } finally {
      busy = false;
    }
  }

  async function pushPocket() {
    if (!gh?.token) return;
    busy = true;
    let sent = 0;
    try {
      for (const n of pocket) {
        await ghAppendFile(
          gh,
          `rides/${n.rideId}/field-notes.md`,
          '\n' + noteToMarkdown(n),
          `field: 포켓 메모 ${n.hhmm} (B_Travel)`,
          fieldNotesTemplate({
            date: n.rideId.slice(0, 10),
            name: n.rideId.slice(11) || '라이딩',
            region: '한국'
          })
        );
        await pocketRemove(n.id);
        sent++;
      }
      await refreshPocket();
      show(`포켓 메모 ${sent}건을 vault repo 로 보냈습니다.`);
    } catch (e) {
      await refreshPocket();
      show(`${sent}건 전송 후 실패: ${e instanceof Error ? e.message : e}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function sharePocket() {
    const text = notesToMarkdown(pocket);
    if (navigator.share) {
      try {
        await navigator.share({ title: `field-notes ${todayRideId}`, text });
        return;
      } catch {
        // 사용자가 취소 — 폴백 없이 종료
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      show('클립보드에 복사했습니다.');
    } catch {
      show('공유/복사에 실패했습니다.', 'error');
    }
  }

  async function removeNote(id: string) {
    await pocketRemove(id);
    await refreshPocket();
  }
</script>

<section class="capture">
  <header>
    <h1>🎙 현장 기록</h1>
    <p class="ride-chip">
      {todayRideId}
      <span class="sink sink-{sink}">
        {sink === 'vault' ? 'vault 직접 저장' : sink === 'github' ? 'vault repo 저장' : '포켓 보관'}
      </span>
    </p>
  </header>

  {#if dictSupported}
    <button class="mic {listening ? 'live' : ''}" onclick={toggleListen} aria-pressed={listening}>
      <span class="mic-icon">{listening ? '⏹' : '🎙'}</span>
      <span class="mic-label">{listening ? '탭해서 멈추기' : '탭하고 말하기'}</span>
    </button>
  {:else}
    <div class="alert error">
      이 브라우저는 음성 받아쓰기를 지원하지 않아요. 아래에 직접 입력하세요.
      (아이폰: 키보드의 🎤 받아쓰기를 쓰면 됩니다)
    </div>
  {/if}

  {#if listening && interim}
    <p class="interim">{interim}</p>
  {/if}

  <textarea
    bind:value={draft}
    rows="4"
    placeholder="말한 내용이 여기 쌓입니다. 손으로 고쳐도 됩니다."
  ></textarea>

  <label class="pin-toggle">
    <input type="checkbox" bind:checked={attachPin} />
    📍 저장할 때 현재 위치 붙이기
  </label>

  <button class="save" onclick={save} disabled={busy || !draft.trim()}>
    {busy ? '저장 중…' : '💾 저장'}
  </button>

  {#if msg}
    <div class="alert {msgKind}">{msg}</div>
  {/if}

  {#if sink === 'pocket' && !gh}
    <p class="hint">
      💡 <a href={`${base}/settings`}>설정에서 GitHub 연동</a>을 하면 폰의 메모가
      vault repo 로 바로 저장됩니다 (Obsidian Git 이 데스크탑으로 끌어옵니다).
    </p>
  {/if}

  {#if pocket.length > 0}
    <div class="pocket">
      <div class="pocket-head">
        <h2>📦 포켓 ({pocket.length}건)</h2>
        <div class="row">
          {#if gh?.token}
            <button class="ghost" onclick={pushPocket} disabled={busy}>⤴ vault 로 전송</button>
          {/if}
          <button class="ghost" onclick={sharePocket}>공유/복사</button>
        </div>
      </div>
      <ul>
        {#each pocket as n (n.id)}
          <li>
            <span class="t">{n.hhmm}</span>
            <span class="txt">{n.text}</span>
            <button class="x" onclick={() => removeNote(n.id)} aria-label="삭제">×</button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .capture {
    display: grid;
    gap: 14px;
    max-width: 480px;
    margin: 0 auto;
  }
  header h1 {
    font-size: 22px;
    margin: 0 0 4px;
  }
  .ride-chip {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sink {
    font-family: inherit;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
  }
  .sink-vault {
    background: rgba(43, 178, 129, 0.15);
    color: var(--accent-bright);
  }
  .sink-github {
    background: rgba(77, 163, 255, 0.15);
    color: #4da3ff;
  }
  .sink-pocket {
    background: rgba(224, 168, 90, 0.15);
    color: var(--warn);
  }

  .mic {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--surface);
    border: 2px solid var(--accent);
    border-radius: 20px;
    padding: 34px 20px;
    color: var(--text);
    -webkit-tap-highlight-color: transparent;
  }
  .mic.live {
    border-color: var(--danger);
    background: rgba(226, 97, 91, 0.08);
    animation: breathe 1.6s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      box-shadow: 0 0 0 10px rgba(226, 97, 91, 0.08);
    }
  }
  .mic-icon {
    font-size: 44px;
    line-height: 1;
  }
  .mic-label {
    font-size: 15px;
    font-weight: 600;
  }

  .interim {
    margin: 0;
    color: var(--accent-bright);
    font-size: 14px;
    min-height: 1.4em;
  }
  textarea {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    padding: 12px;
    font: inherit;
    font-size: 16px; /* iOS 줌 방지 */
    resize: vertical;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent-bright);
  }
  .pin-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-dim);
  }
  .save {
    background: var(--accent);
    color: white;
    border: none;
    padding: 15px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
  }
  .save:disabled {
    opacity: 0.45;
  }
  .alert {
    padding: 10px 12px;
    border-radius: 10px;
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
  .hint {
    color: var(--text-dim);
    font-size: 13px;
    margin: 0;
  }
  .pocket {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
  }
  .pocket-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pocket-head h2 {
    margin: 0;
    font-size: 14px;
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
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
    border-radius: 8px;
    padding: 8px 10px;
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
    font-size: 16px;
    padding: 0 4px;
  }
</style>
