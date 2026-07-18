<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    isFileSystemAccessSupported,
    pickVault,
    resolveRidesDir,
    listRides
  } from '$lib/vault';
  import { loadDemoVault } from '$lib/demo';
  import { vaultHandle, ridesHandle, rides, vaultError, demoMode } from '$lib/stores';
  import {
    saveVaultHandle,
    saveLastModeDemo,
    restoreVaultHandle,
    requestVaultPermission,
    getLastMode,
    loadGithubConfig
  } from '$lib/persist';
  import { computeNextStep, type NextStep } from '$lib/nextstep';
  import { isSkillInstalled, installSkill } from '$lib/skillkit';
  import { copyToClipboard } from '$lib/prompts';
  import type { RideSummary } from '$lib/types';

  let supported = $state(true);
  if (typeof window !== 'undefined') {
    supported = isFileSystemAccessSupported();
  }

  let vh = $state<FileSystemDirectoryHandle | null>(null);
  vaultHandle.subscribe((h) => (vh = h));
  let items = $state<RideSummary[]>([]);
  rides.subscribe((v) => (items = v));
  let isDemo = $state(false);
  demoMode.subscribe((v) => (isDemo = v));

  let gh = $state(loadGithubConfig());

  let busy = $state(false);
  let error = $state<string | null>(null);
  // 저장된 핸들이 있지만 권한 재확인이 필요한 상태
  let pendingHandle = $state<FileSystemDirectoryHandle | null>(null);
  let restoring = $state(true);

  async function connect(root: FileSystemDirectoryHandle, persist: boolean) {
    const rdir = await resolveRidesDir(root);
    const summaries = await listRides(rdir);
    vaultHandle.set(root);
    ridesHandle.set(rdir);
    rides.set(summaries);
    vaultError.set(null);
    demoMode.set(false);
    if (persist) await saveVaultHandle(root);
  }

  // 재방문 시 자동 복원 — 이 앱을 "열면 바로 쓰는" 앱으로 만드는 핵심
  $effect(() => {
    (async () => {
      if (vh) {
        restoring = false;
        return;
      }
      try {
        if (supported) {
          const restored = await restoreVaultHandle();
          if (restored?.state === 'granted') {
            await connect(restored.handle, false);
            return;
          }
          if (restored?.state === 'prompt') {
            pendingHandle = restored.handle;
            return;
          }
        }
        if ((await getLastMode()) === 'demo') {
          await enterDemo(false);
        }
      } catch {
        // 자동 복원 실패는 조용히 — 수동 선택 UI 가 있다
      } finally {
        restoring = false;
      }
    })();
  });

  async function onPick() {
    error = null;
    busy = true;
    try {
      const root = await pickVault();
      await connect(root, true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/AbortError|abort/i.test(msg)) error = msg;
    } finally {
      busy = false;
    }
  }

  async function onReconnect() {
    if (!pendingHandle) return;
    busy = true;
    error = null;
    try {
      const ok = await requestVaultPermission(pendingHandle);
      if (ok) {
        await connect(pendingHandle, false);
        pendingHandle = null;
      } else {
        error = '권한이 거부되었습니다. "다른 폴더 선택"으로 다시 선택해주세요.';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function enterDemo(navigate = true) {
    error = null;
    busy = true;
    try {
      const root = await loadDemoVault(base);
      const rdir = await resolveRidesDir(root);
      const summaries = await listRides(rdir);
      vaultHandle.set(root);
      ridesHandle.set(rdir);
      rides.set(summaries);
      vaultError.set(null);
      demoMode.set(true);
      await saveLastModeDemo();
      if (navigate) await goto(`${base}/rides`);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  // ---------- 데스크탑: 최근 라이딩 + 다음 할 일 ----------
  let latest = $derived<RideSummary | null>(items[0] ?? null);
  let next = $derived<NextStep | null>(latest ? computeNextStep(latest) : null);

  let skillOk = $state<boolean | null>(null);
  $effect(() => {
    if (vh && !isDemo && supported) {
      isSkillInstalled(vh).then((v) => (skillOk = v));
    } else {
      skillOk = null;
    }
  });

  let copied = $state(false);
  async function onNextAction() {
    if (!next || !latest) return;
    if (next.kind === 'capture') return goto(`${base}/capture`);
    if (next.kind === 'listen') return goto(`${base}/listen`);
    if (next.kind === 'upload-gpx' || next.kind === 'review-fact') {
      return goto(`${base}/rides/${encodeURIComponent(latest.id)}`);
    }
    if (next.kind === 'run-cli' && next.command) {
      copied = await copyToClipboard(next.command);
      setTimeout(() => (copied = false), 3000);
    }
  }

  let installMsg = $state<string | null>(null);
  async function onInstallSkill() {
    if (!vh) return;
    try {
      const r = await installSkill(vh);
      skillOk = true;
      installMsg = r.installedClaudeMd
        ? 'vault 에 /ride-finish 스킬과 CLAUDE.md 를 설치했습니다.'
        : 'vault 의 /ride-finish 스킬을 설치/갱신했습니다. (기존 CLAUDE.md 는 그대로 둠)';
    } catch (e) {
      installMsg = `설치 실패: ${e instanceof Error ? e.message : e}`;
    }
  }

  function pct(p: number): string {
    return `${Math.round(p * 100)}%`;
  }
</script>

{#if !supported}
  <!-- ========== 폰: 두 개의 큰 버튼 ========== -->
  <section class="mobile-home">
    <p class="greet">
      🚴 <strong>B_Travel</strong>
      {#if gh}
        <span class="chip ok">vault repo 연결됨</span>
      {:else}
        <span class="chip">vault 미연결</span>
      {/if}
    </p>

    <a class="big-card record" href={`${base}/capture`}>
      <span class="big-icon">🎙</span>
      <span class="big-title">기록하기</span>
      <span class="big-sub">라이딩 중 음성 메모 — 오늘 폴더에 자동 저장</span>
    </a>

    <a class="big-card listen" href={`${base}/listen`}>
      <span class="big-icon">🎧</span>
      <span class="big-title">듣기</span>
      <span class="big-sub">출발 전, 어제의 본문 듣기</span>
    </a>

    <a class="start-btn" href={`${base}/capture`}>
      ＋ 새 라이딩 시작
      <span class="start-sub">누르고 말하면 오늘 폴더가 자동으로 생깁니다</span>
    </a>

    <div class="small-links">
      <a href={`${base}/rides`} onclick={(e) => { if (!vh) { e.preventDefault(); enterDemo(); } }}>
        🚴 라이딩 둘러보기
      </a>
      <a href={`${base}/settings`}>⚙ 설정 {gh ? '' : '(GitHub 연동)'}</a>
    </div>

    {#if !gh}
      <p class="hint">
        처음이신가요? <a href={`${base}/settings`}>설정에서 vault repo(GitHub)를 연결</a>하면
        폰의 메모가 데스크탑 vault 로 흘러가고, 본문도 폰에서 바로 들립니다.
      </p>
    {/if}
    {#if error}
      <div class="alert error">{error}</div>
    {/if}
  </section>
{:else}
  <!-- ========== 데스크탑: 다음 할 일 하나 ========== -->
  <section class="desk-home">
    {#if restoring}
      <p class="muted">vault 다시 연결하는 중…</p>
    {:else if !vh}
      <div class="connect">
        <h1>자전거 여행 기록을 한 곳에서</h1>
        <p class="lead">
          현장 음성 → 본문 + 사실레이어(GEO) → 다국어 발행 → 라이딩 중 듣기.
        </p>
        {#if pendingHandle}
          <button class="primary xl" onclick={onReconnect} disabled={busy}>
            🔓 {pendingHandle.name} 다시 연결
          </button>
          <button class="ghost" onclick={onPick} disabled={busy}>다른 폴더 선택</button>
        {:else}
          <button class="primary xl" onclick={onPick} disabled={busy}>
            {busy ? '읽는 중…' : '📁 vault 폴더 선택'}
          </button>
          <button class="ghost" onclick={() => enterDemo()} disabled={busy}>🚴 데모 둘러보기</button>
        {/if}
        <p class="hint">한 번 선택하면 다음부터는 자동으로 연결됩니다.</p>
        {#if error}
          <div class="alert error">{error}</div>
        {/if}
      </div>
    {:else}
      {#if latest && next}
        <div class="focus-card">
          <div class="focus-head">
            <div>
              <p class="focus-date">{latest.date} · {latest.region} {isDemo ? '· 데모' : ''}</p>
              <h1 class="focus-name">{latest.name}</h1>
            </div>
            <div class="progress-ring" title={`진행 ${pct(latest.workflowProgress)}`}>
              {pct(latest.workflowProgress)}
            </div>
          </div>

          <button class="primary xl next" onclick={onNextAction}>
            {copied ? '✅ 복사됨 — vault 터미널에 붙여넣으세요' : next.label}
          </button>
          <p class="focus-hint">{next.hint}</p>
          {#if next.kind === 'run-cli'}
            <code class="cmd">{next.command}</code>
            {#if skillOk === false}
              <div class="alert warn">
                vault 에 /ride-finish 스킬이 아직 없습니다.
                <button class="inline" onclick={onInstallSkill}>지금 설치</button>
              </div>
            {/if}
          {/if}

          <div class="focus-links">
            <a href={`${base}/rides/${encodeURIComponent(latest.id)}`}>자세히 보기 →</a>
            <a href={`${base}/rides`}>모든 라이딩 ({items.length})</a>
          </div>
        </div>

        {#if isDemo}
          <button class="start-btn" onclick={onPick} disabled={busy}>
            ＋ 새 라이딩 시작 — 내 vault 폴더 연결
          </button>
          <p class="start-hint">
            위 카드는 데모입니다. 내 vault 를 연결하면 내 라이딩이 여기 나타납니다.
          </p>
        {:else}
          <a class="start-btn" href={`${base}/rides/new`}>＋ 새 라이딩 시작</a>
        {/if}
      {:else}
        <div class="focus-card">
          <h1>첫 라이딩을 시작하세요</h1>
          <p class="focus-hint">폰에서 🎙 기록하면 오늘 폴더가 자동으로 생깁니다. 또는:</p>
          <a class="primary xl next center" href={`${base}/rides/new`}>+ 새 라이딩 만들기</a>
        </div>
      {/if}

      {#if !isDemo && skillOk === false && next?.kind !== 'run-cli'}
        <div class="alert warn">
          💡 vault 에 <code>/ride-finish</code> 스킬을 설치하면 본문·사실레이어가
          터미널 한 줄로 끝납니다.
          <button class="inline" onclick={onInstallSkill}>설치</button>
        </div>
      {/if}
      {#if installMsg}
        <div class="alert ok">{installMsg}</div>
      {/if}
      {#if error}
        <div class="alert error">{error}</div>
      {/if}
    {/if}
  </section>
{/if}

<style>
  /* ---------- 폰 ---------- */
  .mobile-home {
    display: grid;
    gap: 14px;
    max-width: 480px;
    margin: 0 auto;
  }
  .greet {
    margin: 4px 0 2px;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chip {
    font-size: 11px;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }
  .chip.ok {
    color: var(--accent-bright);
    border-color: var(--accent);
  }
  .big-card {
    display: grid;
    justify-items: start;
    gap: 4px;
    padding: 26px 22px;
    border-radius: 18px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    -webkit-tap-highlight-color: transparent;
  }
  .big-card:hover {
    text-decoration: none;
    border-color: var(--accent-bright);
  }
  .big-card.record {
    border-color: var(--accent);
    background: linear-gradient(160deg, rgba(43, 178, 129, 0.12), var(--surface) 55%);
  }
  .big-icon {
    font-size: 40px;
    line-height: 1;
  }
  .big-title {
    font-size: 20px;
    font-weight: 800;
  }
  .big-sub {
    font-size: 13px;
    color: var(--text-dim);
  }
  .small-links {
    display: flex;
    gap: 14px;
    font-size: 14px;
    flex-wrap: wrap;
  }
  .start-btn {
    display: grid;
    justify-items: center;
    gap: 2px;
    width: 100%;
    background: transparent;
    border: 2px dashed var(--accent);
    color: var(--accent-bright);
    border-radius: 14px;
    padding: 14px 18px;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .start-btn:hover {
    text-decoration: none;
    background: rgba(43, 178, 129, 0.08);
  }
  .start-btn:disabled {
    opacity: 0.5;
  }
  .start-sub {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-dim);
  }
  .start-hint {
    margin: 0;
    color: var(--text-dim);
    font-size: 13px;
    text-align: center;
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
    margin: 0;
  }

  /* ---------- 데스크탑 ---------- */
  .desk-home {
    display: grid;
    gap: 14px;
    max-width: 640px;
    margin: 0 auto;
  }
  .connect h1 {
    font-size: 26px;
    margin: 8px 0 4px;
  }
  .lead {
    color: var(--text-dim);
    margin: 0 0 18px;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
  }
  .primary.xl {
    padding: 14px 22px;
    font-size: 16px;
    margin-right: 10px;
  }
  .primary:hover {
    background: var(--accent-bright);
  }
  .primary:disabled {
    opacity: 0.5;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 13px 18px;
    border-radius: 10px;
    font-size: 14px;
  }
  .connect .hint {
    margin-top: 12px;
  }

  .focus-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px 24px;
    display: grid;
    gap: 10px;
  }
  .focus-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .focus-date {
    margin: 0;
    font-size: 12px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .focus-name {
    margin: 2px 0 0;
    font-size: 24px;
  }
  .progress-ring {
    flex-shrink: 0;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    border: 3px solid var(--accent);
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--accent-bright);
  }
  .next {
    width: 100%;
    text-align: center;
    display: block;
  }
  .next.center {
    text-decoration: none;
  }
  .focus-hint {
    margin: 0;
    color: var(--text-dim);
    font-size: 13px;
  }
  .cmd {
    display: block;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--accent-bright);
    overflow-x: auto;
  }
  .focus-links {
    display: flex;
    gap: 16px;
    font-size: 13px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .muted {
    color: var(--text-dim);
  }
  .inline {
    background: none;
    border: none;
    color: var(--accent-bright);
    text-decoration: underline;
    padding: 0;
    font-size: inherit;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  .alert {
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
  }
  .alert.error {
    background: rgba(226, 97, 91, 0.1);
    border: 1px solid var(--danger);
    color: #f7c4c1;
  }
  .alert.warn {
    background: rgba(224, 168, 90, 0.1);
    border: 1px solid var(--warn);
    color: var(--warn);
  }
  .alert.ok {
    background: rgba(43, 178, 129, 0.1);
    border: 1px solid var(--accent);
    color: var(--accent-bright);
  }
</style>
