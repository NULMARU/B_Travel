/**
 * GPX → GpxFacts 변환.
 *
 * 기존 scripts/gpx_parse.py 와 동일한 계산식·임계값을 사용한다.
 * 결과 스키마도 같다. (검증 페어: docs/reference/gpx_parse.py)
 *
 * 의존성 0: 브라우저 DOMParser 와 자체 haversine.
 */

import type { GpxFacts, GpxPoint } from './types';

/** 두 좌표 사이 거리 (m). */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function round(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

/** GPX XML 텍스트를 파싱해서 트랙 포인트 배열로 반환. */
export function parseGpxXml(xml: string): GpxPoint[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('GPX XML 파싱 실패: ' + errorNode.textContent);
  }
  const trkpts = Array.from(doc.getElementsByTagName('trkpt'));
  const points: GpxPoint[] = [];
  for (const pt of trkpts) {
    const lat = parseFloat(pt.getAttribute('lat') || 'NaN');
    const lng = parseFloat(pt.getAttribute('lon') || 'NaN');
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const eleEl = pt.getElementsByTagName('ele')[0];
    const timeEl = pt.getElementsByTagName('time')[0];
    points.push({
      latitude: lat,
      longitude: lng,
      elevation: eleEl?.textContent ? parseFloat(eleEl.textContent) : null,
      time: timeEl?.textContent ? new Date(timeEl.textContent) : null
    });
  }
  return points;
}

/**
 * 트랙 포인트 배열에서 객관 사실을 계산한다.
 * 기존 Python 의 임계값 (시속 1km 이상 = 이동중, 200m 미만 시종점 = loop) 그대로.
 */
export function computeFacts(
  points: GpxPoint[],
  sourceFile: string
): GpxFacts {
  if (points.length < 2) {
    throw new Error('GPX 트랙 포인트가 2개 미만');
  }

  let totalDistM = 0;
  let movingDistM = 0;
  let movingTimeS = 0;
  let elevGainM = 0;
  let elevLossM = 0;
  let maxSpeedMs = 0;
  const elevations: number[] = [];

  for (const p of points) {
    if (p.elevation !== null) elevations.push(p.elevation);
  }

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const d = haversine(p0.latitude, p0.longitude, p1.latitude, p1.longitude);
    totalDistM += d;

    if (p0.time && p1.time) {
      const dt = (p1.time.getTime() - p0.time.getTime()) / 1000;
      if (dt > 0) {
        const speedMs = d / dt;
        if (speedMs > 0.278) {
          // ~1 km/h
          movingDistM += d;
          movingTimeS += dt;
          if (speedMs > maxSpeedMs) maxSpeedMs = speedMs;
        }
      }
    }

    if (p0.elevation !== null && p1.elevation !== null) {
      const de = p1.elevation - p0.elevation;
      if (de > 0) elevGainM += de;
      else elevLossM += -de;
    }
  }

  const start = points[0];
  const end = points[points.length - 1];
  const totalTimeS =
    start.time && end.time
      ? (end.time.getTime() - start.time.getTime()) / 1000
      : 0;

  const startEndDist = haversine(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude
  );
  let shape: GpxFacts['route_shape'];
  if (startEndDist < 200) shape = 'loop';
  else if (startEndDist < totalDistM * 0.1) shape = 'out-and-back';
  else shape = 'linear';

  // 최고점
  let maxPt: GpxPoint | null = null;
  for (const p of points) {
    if (p.elevation === null) continue;
    if (!maxPt || (maxPt.elevation ?? -Infinity) < p.elevation) maxPt = p;
  }

  const avgSpeedKmh =
    movingTimeS > 0 ? movingDistM / 1000 / (movingTimeS / 3600) : 0;

  const gainPerKm = totalDistM > 0 ? elevGainM / (totalDistM / 1000) : 0;
  let difficulty: GpxFacts['difficulty_estimate'];
  if (gainPerKm < 10) difficulty = 'easy';
  else if (gainPerKm < 20) difficulty = 'moderate';
  else if (gainPerKm < 35) difficulty = 'hard';
  else difficulty = 'very hard';

  return {
    source_file: sourceFile,
    track_points: points.length,
    distance_km: round(totalDistM / 1000, 1),
    moving_distance_km: round(movingDistM / 1000, 1),
    total_time: formatDuration(totalTimeS),
    moving_time: formatDuration(movingTimeS),
    elevation_gain_m: Math.floor(elevGainM),
    elevation_loss_m: Math.floor(elevLossM),
    max_elevation_m: elevations.length ? Math.floor(Math.max(...elevations)) : null,
    min_elevation_m: elevations.length ? Math.floor(Math.min(...elevations)) : null,
    avg_speed_kmh: round(avgSpeedKmh, 1),
    max_speed_kmh: round(maxSpeedMs * 3.6, 1),
    start: {
      lat: round(start.latitude, 5),
      lng: round(start.longitude, 5),
      time: start.time ? start.time.toISOString() : null,
      elevation_m: start.elevation !== null ? Math.floor(start.elevation) : null
    },
    end: {
      lat: round(end.latitude, 5),
      lng: round(end.longitude, 5),
      time: end.time ? end.time.toISOString() : null,
      elevation_m: end.elevation !== null ? Math.floor(end.elevation) : null
    },
    highest_point: maxPt
      ? {
          lat: round(maxPt.latitude, 5),
          lng: round(maxPt.longitude, 5),
          elevation_m: Math.floor(maxPt.elevation as number)
        }
      : null,
    route_shape: shape,
    difficulty_estimate: difficulty,
    gain_per_km: round(gainPerKm, 1),
    notes: [
      '이 데이터는 GPX 파일에서 자동 추출됨. 검증 필요한 값:',
      '- 거리: 도시 GPS 노이즈로 ±5% 오차 가능',
      '- 평균속도: 신호대기·휴식 제외 (시속 1km 미만은 정지로 간주)',
      `- 난이도 추정: ${gainPerKm.toFixed(1)}m/km 기준 (${difficulty})`
    ]
  };
}

/** XML 텍스트 → 사실 dict 한 방. */
export function parseGpxToFacts(xml: string, sourceFile: string): GpxFacts {
  return computeFacts(parseGpxXml(xml), sourceFile);
}
