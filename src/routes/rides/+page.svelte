<script lang="ts">
  import { goto } from '$app/navigation';
  import { listRides } from '$lib/vault';
  import { ridesHandle, rides, vaultError } from '$lib/stores';
  import type { RideSummary } from '$lib/types';

  let rdir = $state<FileSystemDirectoryHandle | null>(null);
  ridesHandle.subscribe((v) => (rdir = v));
  let items = $state<RideSummary[]>([]);
  rides.subscribe((v) => (items = v));
  let err = $state<string | null>(null);
  vaultError.subscribe((v) => (err = v));

  let refreshing = $state(false);

  async function refresh() {
    if (!rdir) return;
    refreshing = true;
    try {
      const next = await listRides(rdir);
      rides.set(next);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      refreshing = false;
    }
  }

  function pctLabel(p: number): string {
    return `${Math.round(p * 100)}%`;
  }
</script>

<section>
  <header class="head">
    <h1>라이딩</h1>
    <div class="actions">
      {#if rdir}
        <button onclick={refresh} disabled={refreshing} class="ghost">
          {refreshing ? '새로고침 중…' : '🔄 새로고침'}
        </button>
      {/if}
      <button class="primary" onclick={() => goto('/rides/new')} disabled>
        + 새 라이딩 (Sprint 1)
      </button>
    </div>
  </header>

  {#if !rdir}
    <div class="empty">
      <p>아직 vault 를 선택하지 않았습니다.</p>
      <button class="primary" onclick={() => goto('/')}>홈에서 vault 선택하기</button>
    </div>
  {:else if err}
    <div class="alert error">{err}</div>
  {:else if items.length === 0}
    <div class="empty">
      <p><code>rides/</code> 안에 라이딩 폴더가 없습니다.</p>
      <p class="hint">
        폴더 이름은 <code>YYYY-MM-DD_경로명</code> 규약을 따라야 합니다. (예:
        <code>2026-05-20_한강-잠실여의도</code>)
      </p>
    </div>
  {:else}
    <ul class="list">
      {#each items as ride (ride.id)}
        <li>
          <a class="card" href={`/rides/${encodeURIComponent(ride.id)}`}>
            <div class="row1">
              <span class="date">{ride.date}</span>
              <span class="region">{ride.region}</span>
              <span class="status status-{ride.status}">{ride.status}</span>
            </div>
            <div class="name">{ride.name}</div>
            <div class="row2">
              <span class:has={ride.hasFieldNotes}>현장</span>
              <span class:has={ride.hasGpx}>GPX</span>
              <span class:has={ride.hasFactSheet}>사실</span>
              <span class:has={ride.translationLangs.length > 0}>
                번역 {ride.translationLangs.length
                  ? `(${ride.translationLangs.join(', ')})`
                  : ''}
              </span>
            </div>
            <div class="progress" title={`워크플로 진행률 ${pctLabel(ride.workflowProgress)}`}>
              <div class="bar" style={`width: ${ride.workflowProgress * 100}%`}></div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .head h1 {
    margin: 0;
    font-size: 22px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .primary:hover {
    background: var(--accent-bright);
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
  }
  .ghost:hover {
    color: var(--text);
  }

  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 28px;
    text-align: center;
    color: var(--text-dim);
  }
  .empty .primary {
    margin-top: 8px;
  }
  .hint {
    font-size: 13px;
    margin-top: 6px;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }
  .card {
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    color: var(--text);
  }
  .card:hover {
    border-color: var(--accent-bright);
    text-decoration: none;
  }
  .row1 {
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: var(--text-dim);
    align-items: center;
  }
  .date {
    font-family: var(--font-mono);
  }
  .region {
    padding: 1px 8px;
    background: var(--surface-2);
    border-radius: 999px;
  }
  .status {
    margin-left: auto;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
    padding: 1px 8px;
    border-radius: 999px;
  }
  .status-draft {
    background: rgba(224, 168, 90, 0.15);
    color: var(--warn);
  }
  .status-published {
    background: rgba(43, 178, 129, 0.15);
    color: var(--accent-bright);
  }
  .name {
    font-size: 17px;
    font-weight: 600;
    margin: 4px 0 6px;
  }
  .row2 {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 11px;
  }
  .row2 span {
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--surface-2);
    color: var(--text-dim);
  }
  .row2 span.has {
    background: rgba(43, 178, 129, 0.18);
    color: var(--accent-bright);
  }
  .progress {
    margin-top: 10px;
    height: 3px;
    background: var(--surface-2);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--accent-bright);
    transition: width 0.2s ease-out;
  }

  .alert.error {
    background: rgba(226, 97, 91, 0.1);
    border: 1px solid var(--danger);
    color: #f7c4c1;
    padding: 12px;
    border-radius: 8px;
  }
</style>
