/**
 * Minutes, said the way a person says them.
 *
 * The timer, the estimate buttons and the minutes-taken field have been
 * writing numbers into notes for weeks and nothing ever read them back out
 * anywhere you would look. A tick is a fact; an hour and a half is a day.
 */
export function spellMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m}m`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** What a set of notes cost, in minutes. Zero when none of them were timed. */
export function minutesOn(notes: { actualMinutes: number | null }[]): number {
  return notes.reduce((sum, n) => sum + (n.actualMinutes ?? 0), 0);
}
