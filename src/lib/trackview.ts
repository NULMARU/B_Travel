/**
 * GPX 트랙 → 인라인 SVG 기하 계산 (지도 타일·외부 라이브러리 0).
 *
 * 왜 MapLibre 가 아닌가: DEV_PLAN_v0.2 §2.1 참고. 이 앱에서 지도의 역할은
 * "경로의 형태와 고도를 한눈에"이며, 이는 GPX 포인트만으로 오프라인 렌더 가능하다.
 */

import type { GpxPoint } from './types';

export interface TrackGeometry {
  /** 트랙 폴리라인 SVG path (viewBox 0 0 w h 기준) */
  path: string;
  width: number;
  height: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  highest: { x: number; y: number } | null;
  /** 축척 막대: 1km 가 SVG 좌표로 몇 px 인지 */
  pxPerKm: number;
}

export interface ElevationProfile {
  /** 고도 곡선 area path (아래로 닫힘) */
  areaPath: string;
  linePath: string;
  width: number;
  height: number;
  minEle: number;
  maxEle: number;
  totalKm: number;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * 위경도 → 평면 투영(equirectangular, 중앙 위도 보정) 후 viewBox 에 맞춤.
 */
export function computeTrackGeometry(
  points: GpxPoint[],
  width = 640,
  height = 400,
  padding = 24
): TrackGeometry {
  if (points.length < 2) throw new Error('트랙 포인트가 2개 미만');

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);

  // 도 단위 → 평면 (경도에 cos 보정)
  const spanX = Math.max((maxLng - minLng) * cos, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const scale = Math.min(innerW / spanX, innerH / spanY);

  // 축소된 실제 사용 영역을 중앙 배치
  const usedW = spanX * scale;
  const usedH = spanY * scale;
  const ox = (width - usedW) / 2;
  const oy = (height - usedH) / 2;

  const toXY = (p: GpxPoint) => ({
    x: ox + (p.longitude - minLng) * cos * scale,
    y: oy + (maxLat - p.latitude) * scale // 북쪽이 위
  });

  const coords = points.map(toXY);
  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join('');

  // 최고점
  let highestIdx = -1;
  let highestEle = -Infinity;
  points.forEach((p, i) => {
    if (p.elevation !== null && p.elevation > highestEle) {
      highestEle = p.elevation;
      highestIdx = i;
    }
  });

  // 축척: 위도 1도 ≈ 111,320m
  const mPerDegLat = 111320;
  const pxPerKm = (scale / mPerDegLat) * 1000;

  return {
    path,
    width,
    height,
    start: coords[0],
    end: coords[coords.length - 1],
    highest: highestIdx >= 0 ? coords[highestIdx] : null,
    pxPerKm
  };
}

/** 누적 거리 축 고도 프로필. 고도 없는 포인트는 직전 값 유지. */
export function computeElevationProfile(
  points: GpxPoint[],
  width = 640,
  height = 120,
  padding = 8
): ElevationProfile | null {
  const eles = points.filter((p) => p.elevation !== null);
  if (eles.length < 2) return null;

  // 누적 거리 계산
  const dist: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    dist.push(
      dist[i - 1] +
        haversineM(
          points[i - 1].latitude,
          points[i - 1].longitude,
          points[i].latitude,
          points[i].longitude
        )
    );
  }
  const totalM = dist[dist.length - 1];
  if (totalM <= 0) return null;

  let minEle = Infinity;
  let maxEle = -Infinity;
  for (const p of eles) {
    minEle = Math.min(minEle, p.elevation as number);
    maxEle = Math.max(maxEle, p.elevation as number);
  }
  // 평지 트랙도 곡선이 보이도록 최소 20m 범위 확보
  const range = Math.max(maxEle - minEle, 20);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  let lastEle = eles[0].elevation as number;
  const pts: Array<{ x: number; y: number }> = [];
  points.forEach((p, i) => {
    if (p.elevation !== null) lastEle = p.elevation;
    pts.push({
      x: padding + (dist[i] / totalM) * innerW,
      y: padding + innerH - ((lastEle - minEle) / range) * innerH
    });
  });

  const linePath = pts
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join('');
  const areaPath =
    linePath +
    `L${(padding + innerW).toFixed(1)},${(padding + innerH).toFixed(1)}` +
    `L${padding.toFixed(1)},${(padding + innerH).toFixed(1)}Z`;

  return {
    areaPath,
    linePath,
    width,
    height,
    minEle: Math.floor(minEle),
    maxEle: Math.ceil(maxEle),
    totalKm: totalM / 1000
  };
}

/** OSM 웹 지도에서 좌표 확인용 외부 링크. */
export function osmLink(lat: number, lng: number, zoom = 15): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
