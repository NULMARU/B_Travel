<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { createRide } from '$lib/templates';
  import { listRides } from '$lib/vault';
  import { ridesHandle, rides, demoMode } from '$lib/stores';
  import { DEMO_READONLY_MESSAGE } from '$lib/demo';

  let rdir = $state<FileSystemDirectoryHandle | null>(null);
  ridesHandle.subscribe((v) => (rdir = v));
  let isDemo = $state(false);
  demoMode.subscribe((v) => (isDemo = v));

  const today = new Date().toISOString().slice(0, 10);
  let date = $state(today);
  let name = $state('');
  let region = $state('한국');

  let busy = $state(false);
  let err = $state<string | null>(null);

  async function onCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!rdir) return;
    if (isDemo) {
      err = DEMO_READONLY_MESSAGE;
      return;
    }
    if (!name.trim()) {
      err = '경로명을 입력해주세요. (예: 한강-잠실여의도)';
      return;
    }
    busy = true;
    err = null;
    try {
      const id = await createRide(rdir, { date, name: name.trim(), region: region.trim() || '한국' });
      rides.set(await listRides(rdir));
      await goto(`${base}/rides/${encodeURIComponent(id)}`);
    } catch (e2) {
      err = e2 instanceof Error ? e2.message : String(e2);
    } finally {
      busy = false;
    }
  }
</script>

<section>
  <h1>새 라이딩</h1>
  <p class="hint">
    <code>rides/{date}_{name.trim() ? name.trim().replace(/\s+/g, '-') : '경로명'}/</code>
    폴더와 템플릿 4개(index · field-notes · geo-fact · meta) + gpx/photos/tts 폴더를 만듭니다.
  </p>

  {#if !rdir}
    <div class="empty">
      <p>먼저 vault 를 선택해야 합니다.</p>
      <a class="primary-link" href={`${base}/`}>홈에서 vault 선택하기</a>
    </div>
  {:else}
    {#if isDemo}
      <div class="alert warn">{DEMO_READONLY_MESSAGE}</div>
    {/if}
    <form onsubmit={onCreate}>
      <label>
        <span>날짜</span>
        <input type="date" bind:value={date} required />
      </label>
      <label>
        <span>경로명</span>
        <input
          type="text"
          bind:value={name}
          placeholder="예: 한강-잠실여의도"
          required
          autocomplete="off"
        />
      </label>
      <label>
        <span>지역</span>
        <input type="text" bind:value={region} placeholder="예: 한국" />
      </label>

      {#if err}
        <div class="alert error">{err}</div>
      {/if}

      <div class="actions">
        <button type="submit" class="primary" disabled={busy || isDemo}>
          {busy ? '생성 중…' : '+ 라이딩 폴더 생성'}
        </button>
        <a class="ghost-link" href={`${base}/rides`}>취소</a>
      </div>
    </form>
  {/if}
</section>

<style>
  h1 {
    margin: 0 0 6px;
    font-size: 22px;
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
    margin: 0 0 20px;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    display: grid;
    gap: 14px;
    max-width: 480px;
  }
  label {
    display: grid;
    gap: 6px;
    font-size: 13px;
    color: var(--text-dim);
  }
  input {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    padding: 10px 12px;
    font: inherit;
  }
  input:focus {
    outline: none;
    border-color: var(--accent-bright);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
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
    cursor: not-allowed;
  }
  .ghost-link {
    color: var(--text-dim);
    font-size: 14px;
  }
  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 28px;
    text-align: center;
    color: var(--text-dim);
  }
  .primary-link {
    display: inline-block;
    margin-top: 8px;
    background: var(--accent);
    color: white;
    padding: 8px 14px;
    border-radius: 8px;
  }
  .alert {
    padding: 10px 12px;
    border-radius: 8px;
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
</style>
