#!/usr/bin/env python3
"""
GPX 파일에서 자전거 라이딩의 객관적 사실을 추출합니다.

사용법:
    python3 scripts/gpx_parse.py rides/2026-05-20_한강-잠실여의도/gpx/ride.gpx
    → 같은 폴더에 gpx_facts.yaml 생성

이 결과를 Codex에게 넘기면 4단계 사실 레이어 추출의 1차 입력이 됩니다.
"""
from __future__ import annotations
import argparse
import math
import sys
from datetime import timedelta
from pathlib import Path

try:
    import gpxpy
    import yaml
except ImportError:
    print("필요한 패키지 설치: pip install gpxpy pyyaml", file=sys.stderr)
    sys.exit(1)


def haversine(lat1, lon1, lat2, lon2):
    """두 좌표 사이의 거리 (m)."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def parse_gpx(path: Path) -> dict:
    """GPX → 사실 dict."""
    with path.open(encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            for pt in segment.points:
                points.append(pt)

    if not points:
        raise ValueError("GPX에 트랙 포인트가 없음")

    # 거리·시간·고도
    total_dist_m = 0.0
    moving_dist_m = 0.0
    moving_time_s = 0.0
    elev_gain_m = 0.0
    elev_loss_m = 0.0
    elevations = [p.elevation for p in points if p.elevation is not None]
    max_speed_ms = 0.0

    for i in range(1, len(points)):
        p0, p1 = points[i - 1], points[i]
        d = haversine(p0.latitude, p0.longitude, p1.latitude, p1.longitude)
        total_dist_m += d

        if p0.time and p1.time:
            dt = (p1.time - p0.time).total_seconds()
            if dt > 0:
                speed_ms = d / dt
                # 이동 중 정의: 시속 1km 이상
                if speed_ms > 0.278:
                    moving_dist_m += d
                    moving_time_s += dt
                    if speed_ms > max_speed_ms:
                        max_speed_ms = speed_ms

        if (
            p0.elevation is not None
            and p1.elevation is not None
        ):
            de = p1.elevation - p0.elevation
            if de > 0:
                elev_gain_m += de
            else:
                elev_loss_m += -de

    start = points[0]
    end = points[-1]
    start_time = start.time
    end_time = end.time
    total_time_s = (
        (end_time - start_time).total_seconds() if start_time and end_time else 0
    )

    # 경로 모양 추정
    start_end_dist = haversine(
        start.latitude, start.longitude, end.latitude, end.longitude
    )
    if start_end_dist < 200:
        shape = "loop"
    elif start_end_dist < total_dist_m * 0.1:
        shape = "out-and-back"
    else:
        shape = "linear"

    # 최고점
    max_pt = max(
        (p for p in points if p.elevation is not None),
        key=lambda p: p.elevation,
        default=None,
    )

    avg_speed_kmh = (
        (moving_dist_m / 1000) / (moving_time_s / 3600) if moving_time_s > 0 else 0
    )

    def fmt_duration(seconds):
        td = timedelta(seconds=int(seconds))
        h = td.seconds // 3600 + td.days * 24
        m = (td.seconds % 3600) // 60
        return f"{h}:{m:02d}"

    # 난이도 — 거리 대비 상승률
    gain_per_km = elev_gain_m / (total_dist_m / 1000) if total_dist_m > 0 else 0
    if gain_per_km < 10:
        difficulty = "easy"
    elif gain_per_km < 20:
        difficulty = "moderate"
    elif gain_per_km < 35:
        difficulty = "hard"
    else:
        difficulty = "very hard"

    return {
        "source_file": path.name,
        "track_points": len(points),
        "distance_km": round(total_dist_m / 1000, 1),
        "moving_distance_km": round(moving_dist_m / 1000, 1),
        "total_time": fmt_duration(total_time_s),
        "moving_time": fmt_duration(moving_time_s),
        "elevation_gain_m": int(elev_gain_m),
        "elevation_loss_m": int(elev_loss_m),
        "max_elevation_m": int(max(elevations)) if elevations else None,
        "min_elevation_m": int(min(elevations)) if elevations else None,
        "avg_speed_kmh": round(avg_speed_kmh, 1),
        "max_speed_kmh": round(max_speed_ms * 3.6, 1),
        "start": {
            "lat": round(start.latitude, 5),
            "lng": round(start.longitude, 5),
            "time": start_time.isoformat() if start_time else None,
            "elevation_m": int(start.elevation) if start.elevation else None,
        },
        "end": {
            "lat": round(end.latitude, 5),
            "lng": round(end.longitude, 5),
            "time": end_time.isoformat() if end_time else None,
            "elevation_m": int(end.elevation) if end.elevation else None,
        },
        "highest_point": (
            {
                "lat": round(max_pt.latitude, 5),
                "lng": round(max_pt.longitude, 5),
                "elevation_m": int(max_pt.elevation),
            }
            if max_pt
            else None
        ),
        "route_shape": shape,
        "difficulty_estimate": difficulty,
        "gain_per_km": round(gain_per_km, 1),
        "notes": [
            "이 데이터는 GPX 파일에서 자동 추출됨. 검증 필요한 값:",
            f"- 거리: 도시 GPS 노이즈로 ±5% 오차 가능",
            f"- 평균속도: 신호대기·휴식 제외 (시속 1km 미만은 정지로 간주)",
            f"- 난이도 추정: {gain_per_km:.1f}m/km 기준 ({difficulty})",
        ],
    }


def main():
    ap = argparse.ArgumentParser(description="GPX 파일에서 자전거 라이딩 사실 추출")
    ap.add_argument("gpx_path", help="GPX 파일 경로")
    ap.add_argument(
        "-o", "--output",
        help="출력 파일 (기본: gpx_facts.yaml in same folder)",
    )
    args = ap.parse_args()

    gpx_path = Path(args.gpx_path)
    if not gpx_path.exists():
        print(f"파일 없음: {gpx_path}", file=sys.stderr)
        sys.exit(1)

    facts = parse_gpx(gpx_path)

    output = (
        Path(args.output) if args.output
        else gpx_path.parent.parent / "gpx_facts.yaml"
    )
    output.write_text(
        yaml.dump(facts, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    print(f"✓ 사실 추출 완료: {output}")
    print()
    print(f"  거리: {facts['distance_km']} km")
    print(f"  이동시간: {facts['moving_time']}")
    print(f"  상승: {facts['elevation_gain_m']} m")
    print(f"  평균: {facts['avg_speed_kmh']} km/h")
    print(f"  난이도(추정): {facts['difficulty_estimate']}")
    print(f"  경로: {facts['route_shape']}")
    print()
    print(f"이 파일을 geo-fact.md 작성 시 Codex에 입력으로 넘기세요.")


if __name__ == "__main__":
    main()
