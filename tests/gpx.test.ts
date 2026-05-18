/**
 * GPX 파서 회귀 테스트 (가벼운 self-check).
 *
 * 실행:
 *   npm run test:gpx
 *
 * 실제 라이딩 GPX 1건이 생기면, 같은 파일을 Python (scripts/gpx_parse.py) 과
 * 이 TS 파서에 동시에 통과시켜 결과 dict 가 동일한지 확인 (검증 페어).
 *
 * 여기서는 가짜 GPX 한 토막으로 거리·평균속도·경로형태가 기대치인지만 확인.
 */

// node 환경에서 DOMParser 가 없으므로 가벼운 폴리필.
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
// @ts-expect-error: global 주입
globalThis.DOMParser = dom.window.DOMParser;

import { parseGpxToFacts } from '../src/lib/gpx';

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>sample</name><trkseg>
    <trkpt lat="37.51640" lon="127.10080"><ele>30.0</ele><time>2026-05-20T07:00:00Z</time></trkpt>
    <trkpt lat="37.51740" lon="127.10180"><ele>30.5</ele><time>2026-05-20T07:01:00Z</time></trkpt>
    <trkpt lat="37.51840" lon="127.10280"><ele>31.0</ele><time>2026-05-20T07:02:00Z</time></trkpt>
    <trkpt lat="37.51940" lon="127.10380"><ele>32.0</ele><time>2026-05-20T07:03:00Z</time></trkpt>
    <trkpt lat="37.52040" lon="127.10480"><ele>33.0</ele><time>2026-05-20T07:04:00Z</time></trkpt>
    <trkpt lat="37.52140" lon="127.10580"><ele>34.0</ele><time>2026-05-20T07:05:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

function assert(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name}`, detail !== undefined ? detail : '');
    process.exitCode = 1;
  }
}

console.log('gpx.ts smoke test');
const facts = parseGpxToFacts(SAMPLE_GPX, 'sample.gpx');

assert('track_points = 6', facts.track_points === 6, facts.track_points);
assert('route_shape = linear', facts.route_shape === 'linear', facts.route_shape);
assert(
  'distance 0.5~1.0km 범위',
  facts.distance_km > 0.5 && facts.distance_km < 1.0,
  facts.distance_km
);
assert(
  'avg_speed_kmh 양수',
  facts.avg_speed_kmh > 0,
  facts.avg_speed_kmh
);
assert(
  'difficulty = easy',
  facts.difficulty_estimate === 'easy',
  facts.difficulty_estimate
);
assert(
  'start.lat 소수점 5자리',
  facts.start.lat === 37.5164,
  facts.start.lat
);
assert(
  '5km/h 보다 느리지 않음 (실제 약 6km/h)',
  facts.avg_speed_kmh >= 5,
  facts.avg_speed_kmh
);

console.log('\nfacts:', JSON.stringify(facts, null, 2));
