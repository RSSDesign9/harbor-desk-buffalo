/**
 * Count of boat models that failed to build this session (T18), for the shell's “simple shapes stand in” note.
 * Deliberately dependency-free: the shell imports it, and importing the generators instead would pull three.js
 * and every boat generator into the first-paint bundle (a Batch 7 regression caught by the build sizes).
 */
let failures = 0;
const listeners = new Set<() => void>();
export function reportModelFailure() {
  failures += 1;
  for (const l of listeners) l();
}
export const modelFailures = () => failures;
export function subscribeModelFailures(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
