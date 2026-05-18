<script lang="ts">
  import { vaultHandle, ridesHandle, rides } from '$lib/stores';

  let v = $state<FileSystemDirectoryHandle | null>(null);
  vaultHandle.subscribe((h) => (v = h));
  let r = $state<FileSystemDirectoryHandle | null>(null);
  ridesHandle.subscribe((h) => (r = h));
  let n = $state(0);
  rides.subscribe((rs) => (n = rs.length));

  function disconnect() {
    vaultHandle.set(null);
    ridesHandle.set(null);
    rides.set([]);
  }
</script>

<section>
  <h1>설정</h1>

  <div class="block">
    <h2>현재 vault</h2>
    {#if v}
      <dl>
        <dt>루트 폴더</dt>
        <dd>📁 {v.name}</dd>
        <dt>rides 폴더</dt>
        <dd>📁 {r?.name ?? '—'}</dd>
        <dt>스캔된 라이딩 수</dt>
        <dd>{n}건</dd>
      </dl>
      <button class="ghost" onclick={disconnect}>vault 연결 해제</button>
    {:else}
      <p class="muted">아직 vault 를 선택하지 않았습니다. <a href="/">홈에서 선택하기</a></p>
    {/if}
  </div>

  <div class="block">
    <h2>지원되는 기능 (Sprint 0)</h2>
    <ul>
      <li>✅ vault 폴더 선택 (File System Access API)</li>
      <li>✅ rides/* 목록 스캔 + 워크플로 진행률 표시</li>
      <li>✅ 라이딩 상세 보기 (본문 · 현장메모 · 사실레이어 · meta.yaml)</li>
      <li>✅ 사실레이어 GEO 린터 (1인칭 / 주관 형용사 / 단위 누락)</li>
      <li>✅ GPX 파싱 (브라우저, 기존 Python 스키마 호환)</li>
    </ul>
    <h3>다음 스프린트에서</h3>
    <ul class="muted">
      <li>Sprint 1: 새 라이딩 생성, 모바일 음성 메모, 사진 첨부</li>
      <li>Sprint 2: GPX 업로드·지도 표시, 마크다운 에디터, CLI 핸드오프 버튼</li>
      <li>Sprint 3: 번역 탭 UI 강화</li>
      <li>Sprint 4: TTS 큐, GitHub Pages 발행 자동화</li>
    </ul>
  </div>

  <div class="block">
    <h2>이 디바이스 / 네트워크</h2>
    <dl>
      <dt>File System Access API</dt>
      <dd>
        {typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
          ? '✅ 지원'
          : '❌ 미지원 (Chrome · Edge · Arc 등 Chromium 계열에서 열어주세요)'}
      </dd>
      <dt>Service Worker (PWA)</dt>
      <dd>
        {typeof navigator !== 'undefined' && 'serviceWorker' in navigator
          ? '✅ 사용 가능'
          : '❌ 미지원'}
      </dd>
      <dt>Web Speech API (받아쓰기)</dt>
      <dd>
        {typeof window !== 'undefined' &&
        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
          ? '✅ 사용 가능'
          : '❌ 미지원 (Sprint 1 에서 대체 입력 제공)'}
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
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 14px;
  }
  .block h2 {
    margin: 0 0 10px;
    font-size: 16px;
  }
  .block h3 {
    margin: 14px 0 6px;
    font-size: 14px;
    color: var(--text-dim);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0 0 8px;
  }
  dt {
    color: var(--text-dim);
    font-size: 13px;
  }
  dd {
    margin: 0;
    font-size: 14px;
  }
  ul {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
  }
  .muted {
    color: var(--text-dim);
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
  }
  .ghost:hover {
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
