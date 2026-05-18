/**
 * Domain types for B_Travel.
 * 기존 vault 의 폴더 규약 (rides/YYYY-MM-DD_경로명/) 을 그대로 따른다.
 */

export type WorkflowStep = 'plan' | 'field' | 'write' | 'fact_extract' | 'translate' | 'tts';

export type WorkflowStatus = 'pending' | 'in_progress' | 'done';

export interface WorkflowState {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  name: WorkflowStep;
  status: WorkflowStatus;
  depends_on?: number[];
}

export interface RideMeta {
  id: string; // "YYYY-MM-DD_경로명"
  name: string;
  date: string; // ISO date "YYYY-MM-DD"
  region: string;
  status: 'draft' | 'published';
}

export interface RideFiles {
  index: string;
  fact_ko: string;
  translations: string[];
  field_notes: string;
  gpx_dir: string;
  photos_dir: string;
  tts_dir: string;
}

export interface RideManifest {
  ride: RideMeta;
  files: RideFiles;
  workflow: WorkflowState[];
}

/** A summary of a ride as shown on the list screen. */
export interface RideSummary {
  id: string;
  name: string;
  date: string;
  region: string;
  status: 'draft' | 'published';
  hasGpx: boolean;
  hasFieldNotes: boolean;
  hasFactSheet: boolean;
  translationLangs: string[];
  workflowProgress: number; // 0..1
}

/** GPX-derived objective facts. Mirrors the YAML produced by scripts/gpx_parse.py. */
export interface GpxFacts {
  source_file: string;
  track_points: number;
  distance_km: number;
  moving_distance_km: number;
  total_time: string; // "h:mm"
  moving_time: string;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_elevation_m: number | null;
  min_elevation_m: number | null;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  start: GpxEndpoint;
  end: GpxEndpoint;
  highest_point: GpxHighest | null;
  route_shape: 'loop' | 'out-and-back' | 'linear';
  difficulty_estimate: 'easy' | 'moderate' | 'hard' | 'very hard';
  gain_per_km: number;
  notes: string[];
}

export interface GpxEndpoint {
  lat: number;
  lng: number;
  time: string | null;
  elevation_m: number | null;
}

export interface GpxHighest {
  lat: number;
  lng: number;
  elevation_m: number;
}

/** A raw GPX track point (used internally by the parser). */
export interface GpxPoint {
  latitude: number;
  longitude: number;
  elevation: number | null;
  time: Date | null;
}
