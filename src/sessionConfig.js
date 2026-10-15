import { PHASES } from './session.js';

export const DEFAULT_ROUNDS = [1, 2, 3].map(round => Object.fromEntries(
  ['breathing', 'hold', 'relax'].map(type => [type, PHASES.find(p => p.round === round && p.type === type)?.duration || 0])
));
export const DEFAULT_STANDARD = { inhale: 5, exhale: 5, cycles: 30 };
export function validRounds(rounds) {
  return Array.isArray(rounds) && rounds.length > 0 && rounds.length <= 12 && rounds.every(r => r &&
    ['breathing', 'hold', 'relax'].every(k => Number.isInteger(r[k]) && r[k] >= (k === 'breathing' ? 1 : 0) && r[k] <= 600));
}
export function validStandard(s) {
  return s && ['inhale', 'exhale', 'cycles'].every(k => Number.isInteger(s[k]) && s[k] >= 1 && s[k] <= (k === 'cycles' ? 120 : 30));
}
export function buildPhases(mode, rounds, standard) {
  if (mode === 'standard') return Array.from({ length: standard.cycles }, (_, i) => [
    { round: i + 1, type: 'inhale', duration: standard.inhale },
    { round: i + 1, type: 'exhale', duration: standard.exhale },
  ]).flat();
  return rounds.flatMap((r, i) => ['breathing', 'hold', 'relax'].filter(type => r[type] > 0).map(type => ({ round: i + 1, type, duration: r[type] })));
}
