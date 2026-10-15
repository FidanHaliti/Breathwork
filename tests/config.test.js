import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROUNDS, DEFAULT_STANDARD, validRounds, validStandard, buildPhases } from '../src/sessionConfig.js';
import { SessionClock } from '../src/session.js';

test('standard rhythm repeats 5/5 without holds and finishes at five minutes', () => {
  const phases = buildPhases('standard', DEFAULT_ROUNDS, DEFAULT_STANDARD);
  let now = 0;
  const clock = new SessionClock(() => now, phases);
  assert.equal(clock.snapshot().total, 300);
  clock.start(); now = 5000;
  assert.equal(clock.snapshot().phase.type, 'exhale');
  now = 10000;
  assert.equal(clock.snapshot().phase.round, 2);
  now = 300000;
  assert.equal(clock.snapshot().status, 'complete');
});
test('custom rounds omit zero phases and reconfiguration resets elapsed time', () => {
  const rounds = [{ breathing: 7, hold: 0, relax: 0 }, { breathing: 3, hold: 2, relax: 1 }];
  assert.ok(validRounds(rounds));
  const phases = buildPhases('dynamic', rounds, DEFAULT_STANDARD);
  assert.equal(phases.length, 4);
  let now = 0;
  const clock = new SessionClock(() => now);
  clock.start(); now = 20000;
  clock.configure(phases);
  assert.equal(clock.snapshot().status, 'idle');
  assert.equal(clock.snapshot().total, 13);
  clock.start(); now += 7000;
  assert.equal(clock.snapshot().phase.round, 2);
  now += 6000;
  assert.equal(clock.snapshot().complete, true);
});
test('invalid persisted settings are rejected', () => {
  for (const value of [null, [], {}, [{ breathing: 0, hold: 0, relax: 0 }], [{ breathing: 1.5, hold: 2, relax: 1 }]]) assert.equal(validRounds(value), false);
  assert.ok(!validStandard({ inhale: 0, exhale: 5, cycles: 30 }));
  assert.ok(!validStandard({ inhale: 5, exhale: 5, cycles: 121 }));
  assert.ok(validStandard(DEFAULT_STANDARD));
});
