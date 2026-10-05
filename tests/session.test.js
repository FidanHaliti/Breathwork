import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, TOTAL_SECONDS, SessionClock, getSessionPosition, formatTime } from '../src/session.js';
import { findAlbanianVoice, CueAudio, COUNTDOWN_CLIPS } from '../src/audio.js';

test('the eight phases total exactly 10:10 and transition at every boundary', () => {
  assert.equal(TOTAL_SECONDS, 610);
  assert.equal(formatTime(TOTAL_SECONDS), '10:10');
  let elapsed = 0;
  PHASES.forEach((phase, index) => {
    const current = getSessionPosition(elapsed);
    assert.equal(current.index, index);
    assert.equal(current.remaining, phase.duration);
    assert.equal(getSessionPosition(elapsed + phase.duration * 1000 - 1).remaining, 1);
    elapsed += phase.duration * 1000;
  });
  assert.equal(getSessionPosition(elapsed).complete, true);
  assert.equal(getSessionPosition(elapsed + 120000).totalProgress, 1);
});

test('pause preserves fractional milliseconds, resume and repeated start stay precise', () => {
  let now = 1000;
  const clock = new SessionClock(() => now);
  clock.start(); now += 12345; clock.start();
  assert.equal(clock.getElapsed(), 12345);
  clock.pause(); now += 90000;
  assert.equal(clock.getElapsed(), 12345);
  clock.start(); now += 47655;
  assert.equal(clock.snapshot().index, 1);
  assert.equal(clock.snapshot().remaining, 30);
});

test('background catch-up crosses multiple phases and completes without drift', () => {
  let now = 0;
  const clock = new SessionClock(() => now);
  clock.start(); now = 309123;
  assert.equal(clock.snapshot().index, 5);
  assert.equal(clock.snapshot().remaining, 1);
  now = 900000;
  assert.equal(clock.snapshot().status, 'complete');
  clock.start();
  assert.equal(clock.snapshot().remaining, 60);
  assert.equal(clock.snapshot().status, 'running');
});

test('reset returns paused/running/completed sessions to the first phase', () => {
  let now = 0;
  const clock = new SessionClock(() => now);
  for (const elapsed of [4321, 155999, 700000]) {
    clock.start(); now += elapsed; clock.snapshot(); clock.reset();
    assert.equal(clock.snapshot().status, 'idle');
    assert.equal(clock.snapshot().index, 0);
    assert.equal(clock.snapshot().remaining, 60);
    assert.equal(clock.snapshot().totalProgress, 0);
  }
});

test('only a genuinely Albanian-language voice is eligible', () => {
  const english = { name: 'Albanian impersonator', lang: 'en-US' };
  const albanian = { name: 'Shqip', lang: 'sq-AL' };
  assert.equal(findAlbanianVoice([english]), null);
  assert.equal(findAlbanianVoice([english, albanian]), albanian);
  assert.equal(findAlbanianVoice([{ lang: 'sq' }]).lang, 'sq');
});

test('voice ON uses sq-AL, missing voice or OFF uses one beep', () => {
  const spoken = [];
  globalThis.window = { speechSynthesis: { cancel() {}, speak(utterance) { spoken.push(utterance); } } };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  const cues = new CueAudio();
  let beeps = 0;
  cues.beep = () => beeps++;
  cues.countdown('PESË', true);
  assert.equal(beeps, 1); assert.equal(spoken.length, 0);
  cues.voice = { lang: 'sq-AL' };
  cues.countdown('KATËR', true);
  assert.equal(spoken[0].lang, 'sq-AL');
  assert.equal(spoken[0].voice, cues.voice);
  assert.equal(spoken[0].text, 'katër');
  cues.countdown('TRE', false);
  assert.equal(beeps, 2); assert.equal(spoken.length, 1);
  delete globalThis.window; delete globalThis.SpeechSynthesisUtterance;
});

function fakeRecordedAudio(t, { fetchClip } = {}) {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;
  const requests = [], sources = [], spoken = [], contexts = [];
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
      contexts.push(this);
    }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    async decodeAudioData(bytes) { return { number: new Uint8Array(bytes)[0], duration: 0.5 }; }
    createGain() {
      return { gain: { value: 1 }, connect() { return this; }, disconnect() {} };
    }
    createBufferSource() {
      const source = {
        starts: 0, stops: 0, disconnects: 0,
        connect() { return this; },
        disconnect() { this.disconnects++; },
        start() { this.starts++; },
        stop() { this.stops++; this.onended?.(); },
      };
      sources.push(source);
      return source;
    }
  }
  globalThis.window = {
    AudioContext: FakeAudioContext,
    speechSynthesis: { cancel() {}, speak(utterance) { spoken.push(utterance); } },
  };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.fetch = async (url, options) => {
    requests.push(url);
    if (fetchClip) return fetchClip(url, options);
    return { ok: true, arrayBuffer: async () => new Uint8Array([Number(url.match(/sq-(\d)\.wav$/)[1])]).buffer };
  };
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    if (originalUtterance === undefined) delete globalThis.SpeechSynthesisUtterance; else globalThis.SpeechSynthesisUtterance = originalUtterance;
  });
  return { requests, sources, spoken, contexts };
}

test('unlock loads and decodes each bundled Albanian recording once', async (t) => {
  const { requests } = fakeRecordedAudio(t);
  const states = [];
  const cues = new CueAudio(state => states.push(state));
  await Promise.all([cues.unlock(), cues.unlock()]);
  assert.equal(requests.length, 5);
  assert.deepEqual(new Set(requests), new Set(Object.values(COUNTDOWN_CLIPS)));
  assert.equal(cues.recordingState, 'ready');
  assert.ok(states.includes('loading'));
  assert.equal(states.at(-1), 'ready');
  for (const [word, number] of [['PESË', 5], ['KATËR', 4], ['TRE', 3], ['DY', 2], ['NJË', 1]]) {
    assert.equal(cues.buffers.get(word).number, number);
  }
  await cues.unlock();
  assert.equal(requests.length, 5);
  cues.dispose();
});

test('recordings take precedence and stop on replacement, mute, pause/reset and disposal', async (t) => {
  const { sources, spoken } = fakeRecordedAudio(t);
  const cues = new CueAudio();
  let beeps = 0;
  cues.beep = () => beeps++;
  cues.voice = { lang: 'sq-AL' };
  await cues.unlock();
  cues.countdown('PESË', true);
  assert.equal(sources[0].buffer.number, 5);
  assert.equal(sources[0].starts, 1);
  assert.equal(spoken.length, 0);
  assert.equal(beeps, 0);
  cues.countdown('KATËR', true);
  assert.equal(sources[0].stops, 1);
  assert.equal(sources[1].buffer.number, 4);
  cues.cancelSpeech();
  assert.equal(sources[1].stops, 1);
  cues.countdown('TRE', false);
  assert.equal(sources.length, 2);
  assert.equal(beeps, 1);
  cues.countdown('DY', true);
  cues.silence();
  assert.equal(sources[2].stops, 1);
  cues.countdown('NJË', true);
  cues.dispose();
  assert.equal(sources[3].stops, 1);
  assert.equal(cues.context, null);
  assert.equal(spoken.length, 0);
});

test('an unavailable recording falls back to Albanian speech or a beep', async (t) => {
  fakeRecordedAudio(t, { fetchClip: async () => ({ ok: false, status: 404 }) });
  const cues = new CueAudio();
  let beeps = 0;
  cues.beep = () => beeps++;
  await cues.unlock();
  assert.equal(cues.recordingState, 'unavailable');
  cues.countdown('PESË', true);
  assert.equal(beeps, 1);
  cues.voice = { lang: 'sq-AL' };
  const spoken = [];
  window.speechSynthesis.speak = utterance => spoken.push(utterance);
  cues.countdown('KATËR', true);
  assert.equal(spoken[0].text, 'katër');
  assert.equal(spoken[0].lang, 'sq-AL');
  assert.equal(beeps, 1);
  cues.dispose();
});

test('finishing a pending preload after disposal cannot restore recordings or play cues', async (t) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { requests, sources } = fakeRecordedAudio(t, {
    fetchClip: async () => {
      await gate;
      return { ok: true, arrayBuffer: async () => new Uint8Array([5]).buffer };
    },
  });
  const states = [];
  const cues = new CueAudio(state => states.push(state));
  const loading = cues.unlock();
  await Promise.resolve();
  assert.equal(requests.length, 5);
  cues.dispose();
  release();
  await loading;
  assert.equal(cues.context, null);
  assert.equal(cues.buffers.size, 0);
  assert.equal(sources.length, 0);
  assert.ok(!states.includes('ready'));
});
