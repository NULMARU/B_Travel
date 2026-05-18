<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { vaultHandle } from '$lib/stores';

  let { children } = $props();

  // 현재 vault 이름 표시용
  let vaultName = $state<string | null>(null);
  vaultHandle.subscribe((h) => {
    vaultName = h?.name ?? null;
  });

  const navItems = [
    { href: `${base}/`, label: '홈', match: '/' },
    { href: `${base}/rides`, label: '라이딩', match: '/rides' },
    { href: `${base}/settings`, label: '설정', match: '/settings' }
  ];
</script>

<div class="app">
  <header>
    <div class="brand">
      <span class="logo">🚴</span>
      <span class="title">B_Travel</span>
      <span class="version">v0.1</span>
    </div>
    <nav>
      {#each navItems as item}
        {@const path = $page.url.pathname.replace(base, '') || '/'}
        <a
          href={item.href}
          class:active={path === item.match ||
            (path.startsWith(item.match) && item.match !== '/')}
        >
          {item.label}
        </a>
      {/each}
    </nav>
    {#if vaultName}
      <div class="vault-chip" title="현재 선택된 vault">
        📁 {vaultName}
      </div>
    {/if}
  </header>

  <main>
    {@render children?.()}
  </main>

  <footer>
    <span>cre 메타도구 · bike-travel 도메인 · Sprint 0</span>
  </footer>
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

  nav {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
  nav a {
    padding: 6px 12px;
    border-radius: 6px;
    color: var(--text-dim);
    font-size: 14px;
  }
  nav a.active {
    background: var(--surface-2);
    color: var(--text);
  }
  nav a:hover {
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
  }

  main {
    flex: 1;
    max-width: var(--max-width);
    width: 100%;
    margin: 0 auto;
    padding: 24px 20px 80px;
  }

  footer {
    text-align: center;
    color: var(--text-dim);
    font-size: 12px;
    padding: 16px;
    border-top: 1px solid var(--border);
  }
</style>
