/**
 * 새 라이딩 폴더 + 템플릿 생성 (기존 new-ride.sh 포팅).
 *
 * 규약: rides/YYYY-MM-DD_경로명/
 *   index.md · field-notes.md · geo-fact.md · meta.yaml
 *   + gpx/ photos/ tts/ 하위 폴더
 */

export interface NewRideInput {
  date: string; // "YYYY-MM-DD"
  name: string; // 경로명 (예: "한강-잠실여의도")
  region: string;
}

export function rideFolderName(input: NewRideInput): string {
  // 폴더명에 못 들어가는 문자 제거, 공백은 하이픈으로
  const safe = input.name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-');
  return `${input.date}_${safe}`;
}

export function indexTemplate(input: NewRideInput): string {
  return `---
title: "${input.name}"
date: ${input.date}
region: ${input.region}
lang: ko
status: draft
tags:
  - 자전거여행
  - ${input.region}
  - ride-${input.date}
translations: []
gpx: gpx/ride.gpx
fact_sheet: geo-fact.md
---

# ${input.name}

> ${input.date} · ${input.region}

## 라이딩 시작 전

(계획, 날씨, 장비 점검 — 출발 전에 적거나 비워두세요)

## 라이딩 중

(현장 메모(field-notes.md)를 바탕으로, 라이딩 후 본문을 작성합니다)

## 라이딩 끝나고

(정리 소감)
`;
}

export function fieldNotesTemplate(input: NewRideInput): string {
  return `---
ride: ${rideFolderName(input)}
type: field-notes
captured_on: ${input.date}
---

# 현장 메모 — ${input.name}

> 라이딩 중 휴대폰 받아쓰기로 음성 입력한 원본.
> 시간순. 정리하지 않음. 본문 작성의 1차 입력.
`;
}

export function geoFactTemplate(input: NewRideInput): string {
  return `---
ride: ${rideFolderName(input)}
type: fact-sheet
lang: ko
source_post: index.md
gpx: gpx/ride.gpx
status: draft
---

# ${input.name} — Cycling Route Fact Sheet

(채우기 전)

> 4단계에서 "사실레이어 추출 CLI 의뢰" 버튼으로 생성합니다.
`;
}

export function metaTemplate(input: NewRideInput): string {
  const id = rideFolderName(input);
  return `ride:
  id: ${id}
  name: ${input.name}
  date: ${input.date}
  region: ${input.region}
  status: draft
files:
  index: index.md
  fact_ko: geo-fact.md
  translations: []
  field_notes: field-notes.md
  gpx_dir: gpx/
  photos_dir: photos/
  tts_dir: tts/
workflow:
  - { step: 1, name: plan,         status: done }
  - { step: 2, name: field,        status: pending, depends_on: [1] }
  - { step: 3, name: write,        status: pending, depends_on: [2] }
  - { step: 4, name: fact_extract, status: pending, depends_on: [3] }
  - { step: 5, name: translate,    status: pending, depends_on: [4] }
  - { step: 6, name: tts,          status: pending, depends_on: [3] }
`;
}

/** rides/ 핸들 아래에 새 라이딩 폴더와 템플릿 일체를 생성한다. */
export async function createRide(
  ridesDir: FileSystemDirectoryHandle,
  input: NewRideInput
): Promise<string> {
  const id = rideFolderName(input);

  // 중복 방지
  let exists = false;
  try {
    await ridesDir.getDirectoryHandle(id, { create: false });
    exists = true;
  } catch {
    // 없음 — 정상
  }
  if (exists) throw new Error(`이미 같은 이름의 라이딩 폴더가 있습니다: ${id}`);

  const rideDir = await ridesDir.getDirectoryHandle(id, { create: true });

  const writeFile = async (name: string, content: string) => {
    const fh = await rideDir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(content);
    await w.close();
  };

  await writeFile('index.md', indexTemplate(input));
  await writeFile('field-notes.md', fieldNotesTemplate(input));
  await writeFile('geo-fact.md', geoFactTemplate(input));
  await writeFile('meta.yaml', metaTemplate(input));

  await rideDir.getDirectoryHandle('gpx', { create: true });
  await rideDir.getDirectoryHandle('photos', { create: true });
  await rideDir.getDirectoryHandle('tts', { create: true });

  return id;
}
