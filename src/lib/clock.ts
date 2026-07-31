"use client";

import { useSyncExternalStore } from "react";

/**
 * The clock is an external system, so the impure read lives in a snapshot
 * rather than in render. The snapshot is a string because useSyncExternalStore
 * compares by identity — returning a fresh Date every call would loop forever.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day, not UTC: a bill due "today" means today where you are. */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Midnight local on the given key. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(fromKeyStr: string, toKeyStr: string): number {
  const a = fromKey(fromKeyStr).getTime();
  const b = fromKey(toKeyStr).getTime();
  return Math.round((b - a) / 86_400_000);
}

const subscribe = () => () => {};
const onServer = () => "";

/** Empty string on the server; every consumer is gated on the store being ready. */
export function useTodayKey(): string {
  return useSyncExternalStore(subscribe, todayKey, onServer);
}
