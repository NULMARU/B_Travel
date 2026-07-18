<script lang="ts">
  import { stringify as stringifyYaml } from 'yaml';
  import { parseGpxXml, computeFacts } from '$lib/gpx';
  import {
    computeTrackGeometry,
    computeElevationProfile,
    osmLink,
    type TrackGeometry,
    type ElevationProfile
  } from '$lib/trackview';
  import { copyToClipboard } from '$lib/prompts';
  import { rideFinishCommand } from '$lib/skillkit';
  import type { GpxFacts, GpxPoint } from '$lib/types';

  let {
    rideDir,
    rideId,
    readonly,
    fieldText,
    indexText,
    onChanged
  }: {
    rideDir: FileSystemDirectoryHandle | null;
    rideId: string;
    readonly: boolean;
    fieldText: string | null;
    indexText: string | null;
    onChanged: () => void;
  } = $props();

  let canWrite = $derived(!!rideDir && !readonly);

  let gpxFiles = $state<string[]>([]);
  let selected = $state<string | null>(null);
  let points = $state<GpxPoint[]>([]);
  let facts = $state<GpxFacts | null>(null);
  let geom = $state<TrackGeometry | null>(null);
  let profile = $state<ElevationProfile | null>(null);
  let savedFactsYaml = $state<string | null>(null);
  let msg = $state<string | null>(null);
  let msgKind = $state<'ok' | 'error'>('ok');
  let loading = $state(false);

  let factsYaml = $derived(facts ? stringifyYaml(facts) : null);

  function show(m: string, kind: 'ok' | 'error' = 'ok') {
    msg = m;
    msgKind = kind;
  }

  async function scan() {
    if (!rideDir) return;
    loading = true;
    msg = null;
    try {
      const names: string[] = [];
      try {
        const gpxDir = await rideDir.getDirectoryHandle('gpx', { create: false });
        // @ts-expect-error: values() 타입 미포함
        for await (const f of gpxDir.values()) {
          if (f.kind === 'file' && /\.gpx$/i.test(f.name)) names.push(f.name);
        }
      } catch {
        // gpx/ 폴더 없음
      }
      names.sort();
      gpxFiles = names;
      try {
        const fh = await rideDir.getFileHandle('gpx_facts.yaml', { create: false });
        savedFactsYaml = await (await fh.getFile()).text();
      } catch {
        savedFactsYaml = null;
      }
      if (names.length > 0) {
        await select(names[0]);
      } else {
        selected = null;
        points = [];
        facts = null;
        geom = null;
        profile = null;
      }
    } finally {
      loading = false;
    }
  }

  async function select(name: string) {
    if (!rideDir) return;
    selected = name;
    try {
      const gpxDir = await rideDir.getDirectoryHandle('gpx', { create: false });
      const fh = await gpxDir.getFileHandle(name, { create: false });
      const xml = await (await fh.getFile()).text();
      applyXml(xml, name);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  function applyXml(xml: string, name: string) {
    try {
      const pts = parseGpxXml(xml);
      points = pts;
      facts = computeFacts(pts, `gpx/${name}`);
      geom = computeTrackGeometry(pts);
      profile = computeElevationProfile(pts);
      msg = null;
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
      facts = null;
      geom = null;
      profile = null;
    }
  }

  $effect(() => {
    if (rideDir) scan();
  });

  async function onUpload(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !rideDir) return;
    try {
      const xml = await file.text();
      // 파싱이 되는 파일만 저장
      parseGpxXml(xml);
      if (canWrite) {
        const gpxDir = await rideDir.getDirectoryHandle('gpx', { create: true });
        const fh = await gpxDir.getFileHandle(file.name, { create: true });
        const w = await fh.createWritable();
        await w.write(xml);
        await w.close();
        show(`gpx/${file.name} 저장 완료.`);
        await scan();
        await select(file.name);
        onChanged();
      } else {
        // 읽기 전용: 저장 없이 미리보기만
        selected = file.name;
        applyXml(xml, file.name);
        show('읽기 전용 모드 — 저장 없이 미리보기만 합니다.');
      }
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      input.value = '';
    }
  }

  async function saveFacts() {
    if (!rideDir || !factsYaml) return;
    try {
      const fh = await rideDir.getFileHandle('gpx_facts.yaml', { create: true });
      const w = await fh.createWritable();
      await w.write(factsYaml);
      await w.close();
      savedFactsYaml = factsYaml;
      show('gpx_facts.yaml 저장 완료. CLI 의뢰 시 이 값이 컨텍스트로 들어갑니다.');
      onChanged();
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function copyDraftPrompt() {
    const ok = await copyToClipboard(rideFinishCommand(rideId));
    show(
      ok
        ? `복사됨: ${rideFinishCommand(rideId)} — vault 폴더 터미널에 붙여넣으면 본문·사실레이어를 한 번에 만듭니다.`
        : '클립보드 복사 실패',
      ok ? 'ok' : 'error'
    );
  }
</script>

<div class="gpx">
  <div class="toolbar">
    {#if gpxFiles.length > 1}
      <select onchange={(e) => select((e.target as HTMLSelectElement).value)}>
        {#each gpxFiles as f}
          <option value={f} selected={f === selected}>{f}</option>
        {/each}
      </select>
    {:else if selected}
      <span class="filename">📈 {selected}</span>
    {/if}

    <label class="upload">
      ⬆ GPX {canWrite ? '업로드' : '미리보기'}
      <input type="file" accept=".gpx" onchange={onUpload} />
    </label>

    {#if facts}
      <button class="ghost" onclick={saveFacts} disabled={!canWrite}
        title={canWrite ? '' : '읽기 전용 모드에서는 저장할 수 없습니다'}>
        💾 gpx_facts.yaml {savedFactsYaml === factsYaml ? '(저장됨)' : '저장'}
      </button>
      <button class="primary" onclick={copyDraftPrompt}>📋 정리 명령 복사</button>
    {/if}
  </div>

  {#if msg}
    <div class="alert {msgKind}">{msg}</div>
  {/if}

  {#if loading}
    <p class="hint">읽는 중…</p>
  {:else if !facts}
    <div class="empty">
      <p>아직 GPX 파일이 없습니다.</p>
      <p class="hint">
        Strava · Komoot 등에서 export 한 <code>.gpx</code> 를 업로드하면
        거리·고도·속도를 계산하고 트랙을 그립니다. (라이딩 중 GPS 기록은 기존 앱을 쓰세요 —
        웹앱은 "받기"만 잘하면 됩니다)
      </p>
    </div>
  {:else}
    <div class="grid">
      <div class="panel">
        <h3>트랙 <span class="sub">({facts.route_shape})</span></h3>
        {#if geom}
          <svg viewBox={`0 0 ${geom.width} ${geom.height}`} role="img" aria-label="라이딩 트랙 형태">
            <path d={geom.path} class="track" />
            <circle cx={geom.start.x} cy={geom.start.y} r="7" class="pt start" />
            <circle cx={geom.end.x} cy={geom.end.y} r="7" class="pt end" />
            {#if geom.highest}
              <circle cx={geom.highest.x} cy={geom.highest.y} r="5" class="pt high" />
            {/if}
            <!-- 축척 막대 (1km) -->
            {#if geom.pxPerKm > 8 && geom.pxPerKm < geom.width}
              <g class="scale" transform={`translate(16, ${geom.height - 14})`}>
                <line x1="0" y1="0" x2={geom.pxPerKm} y2="0" />
                <text x={geom.pxPerKm / 2} y="-5">1 km</text>
              </g>
            {/if}
          </svg>
          <div class="legend">
            <span><i class="dot start"></i> 출발
              <a href={osmLink(facts.start.lat, facts.start.lng)} target="_blank" rel="noreferrer">
                ({facts.start.lat}, {facts.start.lng}) ↗
              </a>
            </span>
            <span><i class="dot end"></i> 도착
              <a href={osmLink(facts.end.lat, facts.end.lng)} target="_blank" rel="noreferrer">
                ({facts.end.lat}, {facts.end.lng}) ↗
              </a>
            </span>
            {#if facts.highest_point}
              <span><i class="dot high"></i> 최고점 {facts.highest_point.elevation_m}m</span>
            {/if}
          </div>
        {/if}
      </div>

      <div class="panel">
        <h3>계측값</h3>
        <table>
          <tbody>
            <tr><td>거리</td><td>{facts.distance_km} km</td></tr>
            <tr><td>이동 시간</td><td>{facts.moving_time} <span class="sub">/ 총 {facts.total_time}</span></td></tr>
            <tr><td>평균 속도</td><td>{facts.avg_speed_kmh} km/h <span class="sub">(최고 {facts.max_speed_kmh})</span></td></tr>
            <tr><td>누적 상승</td><td>{facts.elevation_gain_m} m <span class="sub">(하강 {facts.elevation_loss_m} m)</span></td></tr>
            <tr><td>난이도</td><td>{facts.difficulty_estimate} <span class="sub">({facts.gain_per_km} m/km)</span></td></tr>
            <tr><td>트랙 포인트</td><td>{facts.track_points}개</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    {#if profile}
      <div class="panel">
        <h3>고도 프로필 <span class="sub">{profile.minEle}m ~ {profile.maxEle}m · {profile.totalKm.toFixed(1)}km</span></h3>
        <svg viewBox={`0 0 ${profile.width} ${profile.height}`} class="elev" role="img" aria-label="고도 프로필">
          <path d={profile.areaPath} class="area" />
          <path d={profile.linePath} class="line" />
        </svg>
      </div>
    {/if}
  {/if}
</div>

<style>
  .gpx {
    display: grid;
    gap: 12px;
  }
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .filename {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-dim);
  }
  select {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 8px 10px;
    font: inherit;
    font-size: 13px;
  }
  .upload {
    display: inline-block;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 13px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  .upload:hover {
    color: var(--text);
  }
  .upload input {
    display: none;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 9px 13px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
  }
  .primary:hover {
    background: var(--accent-bright);
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 13px;
    border-radius: 8px;
    font-size: 13px;
  }
  .ghost:hover:not(:disabled) {
    color: var(--text);
  }
  .ghost:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 720px) {
    .grid {
      grid-template-columns: 3fr 2fr;
    }
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  .panel h3 {
    margin: 0 0 10px;
    font-size: 14px;
  }
  .sub {
    color: var(--text-dim);
    font-weight: 400;
    font-size: 12px;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    background: var(--bg);
    border-radius: 8px;
  }
  .track {
    fill: none;
    stroke: var(--accent-bright);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .pt {
    stroke: var(--bg);
    stroke-width: 2;
  }
  .pt.start {
    fill: #4da3ff;
  }
  .pt.end {
    fill: var(--danger);
  }
  .pt.high {
    fill: var(--warn);
  }
  .scale line {
    stroke: var(--text-dim);
    stroke-width: 2;
  }
  .scale text {
    fill: var(--text-dim);
    font-size: 11px;
    text-anchor: middle;
    font-family: var(--font-mono);
  }
  .legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-dim);
  }
  .legend a {
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-right: 3px;
  }
  .dot.start {
    background: #4da3ff;
  }
  .dot.end {
    background: var(--danger);
  }
  .dot.high {
    background: var(--warn);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  td {
    padding: 6px 4px;
    border-bottom: 1px solid var(--border);
  }
  td:first-child {
    color: var(--text-dim);
    width: 40%;
  }
  .elev .area {
    fill: rgba(43, 178, 129, 0.18);
  }
  .elev .line {
    fill: none;
    stroke: var(--accent-bright);
    stroke-width: 2;
  }
  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 24px;
    text-align: center;
    color: var(--text-dim);
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
  }
  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
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
</style>
