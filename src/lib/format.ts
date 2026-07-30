/** The app states facts about itself. Absolute values, no "2 hours ago". */

export function seqLabel(seq: number): string {
  return `NOTE ${String(seq).padStart(4, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-07-30 08:41 — local time, formatted by hand so it never drifts by locale. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function dayStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function plural(n: number, one: string, many = `${one}S`): string {
  return `${n} ${n === 1 ? one : many}`;
}
