<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    isFileSystemAccessSupported,
    pickVault,
    resolveRidesDir,
    listRides
  } from '$lib/vault';
  import { vaultHandle, ridesHandle, rides, vaultError } from '$lib/stores';

  let busy = $state(false);
  let supported = $state(true);
  let error = $state<string | null>(null);

  if (typeof window !== 'undefined') {
    supported = isFileSystemAccessSupported();
  }

  async function onPick() {
    error = null;
    busy = true;
    try {
      const root = await pickVault();
      const rdir = await resolveRidesDir(root);
      const summaries = await listRides(rdir);
      vaultHandle.set(root);
      ridesHandle.set(rdir);
      rides.set(summaries);
      vaultError.set(null);
      await goto(`${base}/rides`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 사용자 취소는 조용히 무시
      if (!/AbortError|abort/i.test(msg)) {
        error = msg;
        vaultError.set(msg);
      }
    } finally {
      busy = false;
    }
  }
</script>

<section class="hero">
  <h1>자전거 여행 기록을 한 곳에서</h1>
  <p class="lead">
    현장 음성 → <strong>본문(서사)</strong> + <strong>사실레이어(GEO)</strong> →
    다국어 발행. 라이딩 1건의 6단계를 vault 폴더 하나로 관리합니다.
  </p>

  <div class="pick">
    {#if !supported}
      <div class="alert error">
        이 브라우저는 File System Access API 를 지원하지 않습니다. <br />
        Chrome · Edge · Arc · Brave 등 <strong>Chromium 계열</strong>에서 열어주세요.
        (Safari · Firefox 폴백은 Sprint 2 에서 추가 예정)
      </div>
    {:else}
      <button class="primary" onclick={onPick} disabled={busy}>
        {busy ? '폴더 읽는 중…' : '📁 vault 폴더 선택'}
      </button>
      <p class="hint">
        cre-vault 루트 폴더(rides/ 가 들어있는 폴더)를 선택하세요. <br />
        선택한 폴더는 <em>이 디바이스에만</em> 보관됩니다. 서버로 업로드되지 않습니다.
      </p>
    {/if}
    {#if error}
      <div class="alert error">{error}</div>
    {/if}
  </div>

  <div class="steps">
    <h2>6단계 흐름</h2>
    <ol>
      <li><strong>계획</strong> — 새 라이딩 폴더 + 템플릿 생성</li>
      <li><strong>현장</strong> — 모바일에서 음성 메모·사진 (PWA)</li>
      <li><strong>본문</strong> — GPX + field-notes 통합, 마크다운 본문 작성</li>
      <li><strong>사실레이어</strong> — AI 인용 가능한 fact sheet 추출 + 자동 린팅</li>
      <li><strong>번역</strong> — 라이딩 지역 언어로 GEO 변환</li>
      <li><strong>듣기</strong> — 다음 라이딩 전 본문 TTS 큐</li>
    </ol>
    <p class="hint">
      AI 호출(본문 초안 · 사실 추출 · 번역)은 기존 <code>Claude Code</code> /
      <code>Codex</code> CLI 가 담당합니다. 이 웹앱은 각 단계마다 컨텍스트를 모아
      <em>한 번에 클립보드 복사</em>해주는 인터페이스입니다.
    </p>
  </div>
</section>

<style>
  .hero h1 {
    font-size: 28px;
    margin: 8px 0 6px;
    letter-spacing: -0.3px;
  }
  .lead {
    color: var(--text-dim);
    font-size: 16px;
    margin: 0 0 28px;
    max-width: 60ch;
  }
  .pick {
    background: var(--surface);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--border);
    margin-bottom: 28px;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 12px 18px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .primary:hover {
    background: var(--accent-bright);
  }
  .primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
    margin: 12px 0 0;
  }
  .alert {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 13px;
  }
  .alert.error {
    background: rgba(226, 97, 91, 0.1);
    border: 1px solid var(--danger);
    color: #f7c4c1;
  }
  .steps h2 {
    font-size: 18px;
    margin: 8px 0 12px;
  }
  .steps ol {
    margin: 0 0 12px;
    padding-left: 22px;
    color: var(--text);
  }
  .steps li {
    margin-bottom: 4px;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }
</style>
