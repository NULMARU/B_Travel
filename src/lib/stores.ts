/**
 * 전역 상태 — 현재 vault 핸들과 라이딩 목록.
 * Svelte 5 의 $state rune 를 모듈 스코프에서 export 하기 위해
 * .svelte.ts 가 아닌 일반 ts 에서는 writable store 패턴을 쓴다.
 */

import { writable, type Writable } from 'svelte/store';
import type { RideSummary } from './types';

export const vaultHandle: Writable<FileSystemDirectoryHandle | null> = writable(null);
export const ridesHandle: Writable<FileSystemDirectoryHandle | null> = writable(null);
export const rides: Writable<RideSummary[]> = writable([]);
export const vaultError: Writable<string | null> = writable(null);

/** 데모 모드(읽기 전용 가상 vault) 여부. 쓰기 UI 는 이 값으로 비활성화한다. */
export const demoMode: Writable<boolean> = writable(false);
