/** The app states facts about itself. Absolute values, no "2 hours ago". */

export function seqLabel(seq: number): string {
  return `NOTE ${String(seq).padStart(4, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Still absolute — never "2 hours ago" — but only as much of it as you need.
 *
 * Every card and every row used to carry the full `2026-09-02 18:03`. Sixteen
 * characters of machine text above one line of your own writing, and fifteen
 * of them identical on every note you wrote today. Today gives you the clock,
 * this year gives you the day, and anything older gives you the year back.
 *
 * `now` is injectable so this stays a pure function; callers pass the clock.
 */
export function stamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return time;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getDate()} ${MONTH[d.getMonth()]} ${time}`;
  }
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function plural(n: number, one: string, many = `${one}S`): string {
  return `${n} ${n === 1 ? one : many}`;
}
