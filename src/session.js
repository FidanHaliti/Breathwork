export const PHASES = [
  { round: 1, type: 'breathing', duration: 60 },
  { round: 1, type: 'hold', duration: 30 },
  { round: 1, type: 'relax', duration: 20 },
  { round: 2, type: 'breathing', duration: 120 },
  { round: 2, type: 'hold', duration: 60 },
  { round: 2, type: 'relax', duration: 20 },
  { round: 3, type: 'breathing', duration: 180 },
  { round: 3, type: 'hold', duration: 120 },
];
export const TOTAL_SECONDS = PHASES.reduce((total, phase) => total + phase.duration, 0);
export const PHASE_LABELS = {
  inhale: 'Merr frymë',
  exhale: 'Nxirr frymën',
  breathing: 'Merr dhe nxirr frymën',
  hold: 'Mbaje frymën',
  relax: 'Relax – merr frymë normalisht',
};
export const COUNTDOWN_WORDS = { 5: 'PESË', 4: 'KATËR', 3: 'TRE', 2: 'DY', 1: 'NJË' };
export function formatTime(seconds) {
  const rounded = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(rounded / 60).toString().padStart(2, '0')}:${(rounded % 60).toString().padStart(2, '0')}`;
}
export function getSessionPosition(elapsedMs, phases = PHASES) {
  const total = phases.reduce((sum, p) => sum + p.duration, 0);
  const elapsed = Math.min(total, Math.max(0, elapsedMs / 1000));
  let start = 0;
  for (let index = 0; index < phases.length; index++) {
    const phase = phases[index];
    if (elapsed < start + phase.duration) {
      const phaseElapsed = elapsed - start;
      return { phase, index, elapsed, phaseElapsed, remaining: Math.ceil(phase.duration - phaseElapsed), phaseProgress: phaseElapsed / phase.duration, totalProgress: elapsed / total, complete: false };
    }
    start += phase.duration;
  }
  return { phase: phases.at(-1), index: phases.length, elapsed, phaseElapsed: phases.at(-1).duration, remaining: 0, phaseProgress: 1, totalProgress: 1, complete: true };
}

// A single clock stores elapsed time at pause, plus a real-time anchor while running.
// The interval only refreshes the UI; it never counts seconds or owns transitions.
export class SessionClock {
  constructor(now = () => Date.now(), phases = PHASES) { this.now = now; this.configure(phases); }
  configure(phases) { this.phases = phases; this.total = phases.reduce((sum, p) => sum + p.duration, 0); this.reset(); }
  getElapsed() {
    return Math.min(this.total * 1000, this.saved + (this.status === 'running' ? Math.max(0, this.now() - this.anchor) : 0));
  }
  start() {
    if (this.status === 'running') return;
    if (this.status === 'complete') this.reset();
    this.anchor = this.now();
    this.status = 'running';
  }
  pause() {
    if (this.status !== 'running') return;
    this.saved = this.getElapsed();
    this.status = this.saved >= this.total * 1000 ? 'complete' : 'paused';
  }
  reset() { this.saved = 0; this.anchor = 0; this.status = 'idle'; }
  snapshot() {
    const position = getSessionPosition(this.getElapsed(), this.phases);
    if (position.complete) { this.saved = this.total * 1000; this.status = 'complete'; }
    return { ...position, status: this.status, phases: this.phases, total: this.total };
  }
}
