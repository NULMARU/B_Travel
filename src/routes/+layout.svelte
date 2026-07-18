<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { vaultHandle, demoMode } from '$lib/stores';

  let { children } = $props();

  // 현재 vault 이름 표시용
  let vaultName = $state<string | null>(null);
  vaultHandle.subscribe((h) => {
    vaultName = h?.name ?? null;
  });
  let isDemo = $state(false);
  demoMode.subscribe((v) => (isDemo = v));

  // 데스크탑 상단 내비 + 모바일 하단 탭바가 같은 목록을 쓴다
  const navItems = [
    { href: `${base}/`, label: '홈', icon: '🏠', match: '/' },
    { href: `${base}/capture`, label: '기록', icon: '🎙', match: '/capture' },
    { href: `${base}/listen`, label: '듣기', icon: '🎧', match: '/listen' },
    { href: `${base}/rides`, label: '라이딩', icon: '🚴', match: '/rides' },
    { href: `${base}/settings`, label: '설정', icon: '⚙️', match: '/settings' }
  ];

  let path = $derived($page.url.pathname.replace(base, '') || '/');
  function isActive(match: string): boolean {
    return path === match || (path.startsWith(match) && match !== '/');
  }
</script>

<div class="app">
  <header>
    <div class="brand">
      <span class="logo">🚴</span>
      <span class="title">B_Travel</span>
      <span class="version">v0.3</span>
    </div>
    <nav class="topnav">
      {#each navItems as item}
        <a href={item.href} class:active={isActive(item.match)}>{item.label}</a>
      {/each}
    </nav>
    {#if vaultName}
      <div class="vault-chip" class:demo={isDemo} title={isDemo ? '데모 모드 — 읽기 전용' : '현재 선택된 vault'}>
        {isDemo ? '🚴 데모' : `📁 ${vaultName}`}
      </div>
    {/if}
  </header>

  <main>
    {@render children?.()}
  </main>

  <footer class="deskfoot">
    <span>cre 메타도구 · bike-travel 도메인 · v0.3 — 세 순간, 세 버튼</span>
  </footer>

  <!-- 모바일 하단 탭바 -->
  <nav class="tabbar" aria-label="주요 화면">
    {#each navItems as item}
      <a href={item.href} class:active={isActive(item.match)}>
        <span class="ticon">{item.icon}</span>
        <span class="tlabel">{item.label}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  :global(:root) {
    --bg: #0b1620;
    --surface: #132432;
    --surface-2: #1b3142;
    --border: #244258;
    --text: #e9f1f7;
    --text-dim: #9bb3c4;
    --accent: #0b6e4f;
    --accent-bright: #2bb281;
    --danger: #e2615b;
    --warn: #e0a85a;
    --max-width: 960px;
    --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
    --tabbar-h: 60px;
  }

  :global(*),
  :global(*::before),
  :global(*::after) {
    box-sizing: border-box;
  }

  :global(html, body) {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo',
      'Noto Sans KR', sans-serif;
    font-size: 15px;
    line-height: 1.55;
    -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
  }

  :global(a) {
    color: var(--accent-bright);
    text-decoration: none;
  }
  :global(a:hover) {
    text-decoration: underline;
  }

  :global(button) {
    font: inherit;
    cursor: pointer;
  }

  .app {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  header {
    border-bottom: 1px solid var(--border);
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .brand {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .logo {
    font-size: 20px;
  }
  .title {
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .version {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .topnav {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
  .topnav a {
    padding: 6px 12px;
    border-radius: 6px;
    color: var(--text-dim);
    font-size: 14px;
  }
  .topnav a.active {
    background: var(--surface-2);
    color: var(--text);
  }
  .topnav a:hover {
    text-decoration: none;
    color: var(--text);
  }

  .vault-chip {
    font-size: 12px;
    background: var(--surface-2);
    color: var(--text-dim);
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    max-width: 40vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .vault-chip.demo {
    border-color: var(--accent);
    color: var(--accent-bright);
  }

  main {
    flex: 1;
    max-width: var(--max-width);
    width: 100%;
    margin: 0 auto;
    padding: 24px 20px 80px;
  }

  .deskfoot {
    text-align: center;
    color: var(--text-dim);
    font-size: 12px;
    padding: 16px;
    border-top: 1px solid var(--border);
  }

  /* ---------- 모바일 하단 탭바 ---------- */
  .tabbar {
    display: none;
  }

  @media (max-width: 700px) {
    .topnav {
      display: none; /* 모바일은 하단 탭바가 내비 */
    }
    .deskfoot {
      display: none;
    }
    main {
      padding: 18px 16px calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 24px);
    }
    .tabbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      height: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
    }
    .tabbar a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--text-dim);
      font-size: 11px;
      -webkit-tap-highlight-color: transparent;
    }
    .tabbar a:hover {
      text-decoration: none;
    }
    .tabbar a.active {
      color: var(--accent-bright);
    }
    .ticon {
      font-size: 20px;
      line-height: 1;
    }
  }
</style>
