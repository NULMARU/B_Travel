<script lang="ts">
  import { base } from '$app/paths';
  import { vaultHandle, ridesHandle, rides, demoMode } from '$lib/stores';
  import {
    clearPersistedVault,
    loadGithubConfig,
    saveGithubConfig,
    clearGithubConfig,
    type GithubConfig
  } from '$lib/persist';
  import { ghCheck } from '$lib/github';
  import { isSkillInstalled, installSkill } from '$lib/skillkit';
  import { isFileSystemAccessSupported } from '$lib/vault';

  let v = $state<FileSystemDirectoryHandle | null>(null);
  vaultHandle.subscribe((h) => (v = h));
  let n = $state(0);
  rides.subscribe((rs) => (n = rs.length));
  let isDemo = $state(false);
  demoMode.subscribe((d) => (isDemo = d));

  const fsSupported =
    typeof window !== 'undefined' && isFileSystemAccessSupported();

  async function disconnect() {
    vaultHandle.set(null);
    ridesHandle.set(null);
    rides.set([]);
    demoMode.set(false);
    await clearPersistedVault();
  }

  // ---------- GitHub 연동 ----------
  const existing = typeof window !== 'undefined' ? loadGithubConfig() : null;
  let owner = $state(existing?.owner ?? '');
  let repo = $state(existing?.repo ?? '');
  let branch = $state(existing?.branch ?? 'main');
  let token = $state(existing?.token ?? '');
  let ghMsg = $state<string | null>(null);
  let ghOk = $state<boolean | null>(null);
  let checking = $state(false);
  let connected = $state(!!existing);
  let prefilled = $state(false);

  // 프리필 링크: /settings#gh=owner/repo[/branch]
  // 데스크탑에서 만든 링크를 폰에서 열면 토큰 빼고 전부 채워진다.
  $effect(() => {
    if (typeof location === 'undefined') return;
    const m = location.hash.match(/^#gh=([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
    if (m) {
      owner = decodeURIComponent(m[1]);
      repo = decodeURIComponent(m[2]);
      branch = m[3] ? decodeURIComponent(m[3]) : 'main';
      prefilled = true;
    }
  });

  let shareMsg = $state<string | null>(null);
  async function copyPhoneLink() {
    const url = `${location.origin}${base}/settings#gh=${encodeURIComponent(owner.trim())}/${encodeURIComponent(repo.trim())}/${encodeURIComponent(branch.trim() || 'main')}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'B_Travel 설정 링크', url });
        shareMsg = null;
        return;
      }
      await navigator.clipboard.writeText(url);
      shareMsg = '폰 설정 링크를 복사했습니다. 폰으로 보내서 열면 토큰만 넣으면 됩니다.';
    } catch {
      shareMsg = url;
    }
  }

  async function saveGh(e: SubmitEvent) {
    e.preventDefault();
    ghMsg = null;
    if (!owner.trim() || !repo.trim()) {
      ghMsg = 'owner 와 repo 는 필수입니다.';
      ghOk = false;
      return;
    }
    const config: GithubConfig = {
      owner: owner.trim(),
      repo: repo.trim(),
      branch: branch.trim() || 'main',
      token: token.trim()
    };
    checking = true;
    try {
      const r = await ghCheck(config);
      ghOk = r.ok;
      if (r.ok) {
        saveGithubConfig(config);
        connected = true;
        ghMsg = `저장했습니다 — ${r.detail}`;
      } else {
        ghMsg = r.detail;
      }
    } finally {
      checking = false;
    }
  }

  function removeGh() {
    clearGithubConfig();
    connected = false;
    owner = repo = token = '';
    branch = 'main';
    ghMsg = '연동을 해제했습니다. (토큰은 이 기기에서 삭제됨)';
    ghOk = null;
  }

  // ---------- 스킬 설치 ----------
  let skillOk = $state<boolean | null>(null);
  let skillMsg = $state<string | null>(null);
  $effect(() => {
    if (v && !isDemo && fsSupported) {
      isSkillInstalled(v).then((s) => (skillOk = s));
    } else {
      skillOk = null;
    }
  });
  async function onInstall() {
    if (!v) return;
    try {
      const r = await installSkill(v);
      skillOk = true;
      skillMsg = r.installedClaudeMd
        ? '/ride-finish 스킬 + CLAUDE.md 설치 완료.'
        : '/ride-finish 스킬 설치/갱신 완료. (기존 CLAUDE.md 유지)';
    } catch (e) {
      skillMsg = `설치 실패: ${e instanceof Error ? e.message : e}`;
    }
  }
</script>

<section>
  <h1>설정</h1>

  <div class="block">
    <h2>📁 vault (이 디바이스)</h2>
    {#if v}
      <p class="line">
        {isDemo ? '🚴 데모 vault (읽기 전용)' : `📁 ${v.name}`} · 라이딩 {n}건
      </p>
      {#if !isDemo}
        <p class="muted small">다음 방문부터는 자동으로 다시 연결됩니다.</p>
      {/if}
      <button class="ghost danger-hover" onclick={disconnect}>연결 해제 (자동 연결도 삭제)</button>
    {:else if fsSupported}
      <p class="muted">
        아직 vault 를 선택하지 않았습니다. <a href={`${base}/`}>홈에서 선택하기</a>
      </p>
    {:else}
      <p class="muted">
        이 디바이스(폰)는 폴더 직접 연결이 안 됩니다. 아래 GitHub 연동이 폰의 vault 연결 방법입니다.
      </p>
    {/if}
  </div>

  <div class="block">
    <h2>🔗 vault repo (GitHub 동기화)</h2>
    <p class="muted small">
      폰의 음성 메모를 vault repo 로 바로 저장하고, 본문을 폰에서 바로 듣습니다.
      데스크탑 vault 와는 Obsidian Git 등으로 동기화하세요.
      토큰은 <strong>이 기기 안(localStorage)에만</strong> 저장되며 서버로 가지 않습니다.
    </p>
    {#if prefilled && !connected}
      <div class="alert ok">
        📲 링크로 설정이 채워졌습니다. 아래에서 <strong>토큰만 붙여넣고 저장</strong>하면 끝!
      </div>
    {/if}
    <form onsubmit={saveGh}>
      <div class="grid2">
        <label><span>owner</span><input bind:value={owner} placeholder="NULMARU" autocapitalize="off" /></label>
        <label><span>repo</span><input bind:value={repo} placeholder="cre-vault" autocapitalize="off" /></label>
        <label><span>branch</span><input bind:value={branch} placeholder="main" autocapitalize="off" /></label>
        <label>
          <span>
            토큰 (fine-grained PAT, Contents 읽기/쓰기) ·
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              🔑 GitHub 에서 만들기 ↗
            </a>
          </span>
          <input bind:value={token} type="password" placeholder="github_pat_… (읽기만 하면 비워도 됨)" autocapitalize="off" />
        </label>
      </div>
      <div class="row">
        <button type="submit" class="primary" disabled={checking}>
          {checking ? '확인 중…' : connected ? '다시 저장 · 연결 테스트' : '저장 · 연결 테스트'}
        </button>
        {#if owner.trim() && repo.trim()}
          <button type="button" class="ghost" onclick={copyPhoneLink}>📲 폰 설정 링크 복사</button>
        {/if}
        {#if connected}
          <button type="button" class="ghost danger-hover" onclick={removeGh}>연동 해제</button>
        {/if}
      </div>
      {#if ghMsg}
        <div class="alert {ghOk ? 'ok' : 'error'}">{ghMsg}</div>
      {/if}
      {#if shareMsg}
        <div class="alert ok">{shareMsg}</div>
      {/if}
    </form>
    <details class="help">
      <summary>토큰 만드는 법</summary>
      <ol>
        <li>GitHub → Settings → Developer settings → Fine-grained tokens → Generate</li>
        <li>Repository access: vault repo 하나만 선택</li>
        <li>Permissions: <strong>Contents → Read and write</strong> 만</li>
        <li>생성된 <code>github_pat_…</code> 를 위에 붙여넣기</li>
      </ol>
    </details>
  </div>

  {#if fsSupported}
    <div class="block">
      <h2>🤖 /ride-finish 스킬 (데스크탑 CLI)</h2>
      <p class="muted small">
        vault 에 설치하면 터미널에서 <code>claude "/ride-finish 폴더명"</code> 한 줄로
        본문 → 사실레이어 → 번역까지 처리합니다.
      </p>
      {#if !v || isDemo}
        <p class="muted">내 vault 를 연결하면 설치할 수 있습니다.</p>
      {:else if skillOk === true}
        <p class="line">✅ 설치됨 <button class="inline" onclick={onInstall}>최신으로 갱신</button></p>
      {:else if skillOk === false}
        <button class="primary" onclick={onInstall}>vault 에 설치</button>
      {/if}
      {#if skillMsg}
        <div class="alert ok">{skillMsg}</div>
      {/if}
    </div>
  {/if}

  <div class="block">
    <h2>이 디바이스</h2>
    <dl>
      <dt>폴더 직접 연결 (File System Access)</dt>
      <dd>{fsSupported ? '✅ 지원 (데스크탑 Chromium)' : '❌ 미지원 → GitHub 연동 사용'}</dd>
      <dt>음성 받아쓰기 (Web Speech)</dt>
      <dd>
        {typeof window !== 'undefined' &&
        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
          ? '✅ 사용 가능'
          : '❌ 미지원 (키보드 받아쓰기로 대체)'}
      </dd>
      <dt>음성 합성 (듣기)</dt>
      <dd>
        {typeof window !== 'undefined' && 'speechSynthesis' in window ? '✅ 사용 가능' : '❌ 미지원'}
      </dd>
    </dl>
  </div>
</section>

<style>
  h1 {
    font-size: 22px;
    margin: 0 0 16px;
  }
  .block {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
    margin-bottom: 14px;
  }
  .block h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }
  .line {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .muted {
    color: var(--text-dim);
  }
  .small {
    font-size: 13px;
    margin: 0 0 12px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 520px) {
    .grid2 {
      grid-template-columns: 1fr;
    }
  }
  label {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--text-dim);
  }
  input {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    padding: 10px 12px;
    font: inherit;
    font-size: 16px;
  }
  input:focus {
    outline: none;
    border-color: var(--accent-bright);
  }
  .row {
    display: flex;
    gap: 10px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
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
    padding: 9px 14px;
    border-radius: 8px;
    font-size: 13px;
  }
  .danger-hover:hover {
    color: var(--danger);
    border-color: var(--danger);
  }
  .inline {
    background: none;
    border: none;
    color: var(--accent-bright);
    text-decoration: underline;
    padding: 0;
    font-size: 13px;
  }
  .alert {
    margin-top: 10px;
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
  .help {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-dim);
  }
  .help ol {
    margin: 8px 0 0;
    padding-left: 20px;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;
  }
  @media (max-width: 520px) {
    dl {
      grid-template-columns: 1fr;
    }
    dt {
      margin-top: 6px;
    }
  }
  dt {
    color: var(--text-dim);
    font-size: 13px;
  }
  dd {
    margin: 0;
    font-size: 14px;
  }
</style>
