import { test, expect } from '@playwright/test';

async function observeRecordedCountdown(page, { holdRecordings = false } = {}) {
  await page.addInitScript(({ holdRecordings }) => {
    window.recordedCues = { decoded: [], started: [], stopped: [], tones: 0, spoken: [] };
    const encodedUrls = new WeakMap();
    const decodedUrls = new WeakMap();
    const readBytes = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = async function(...args) {
      const bytes = await readBytes.apply(this, args);
      if (this.url && new URL(this.url).pathname.startsWith('/audio/countdown/')) {
        encodedUrls.set(bytes, new URL(this.url).pathname);
      }
      return bytes;
    };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = async function(bytes, ...args) {
      const url = encodedUrls.get(bytes);
      const buffer = await decode.call(this, bytes, ...args);
      if (url) {
        decodedUrls.set(buffer, url);
        window.recordedCues.decoded.push({ url, duration: buffer.duration });
      }
      return buffer;
    };
    const createSource = AudioContext.prototype.createBufferSource;
    let nextId = 0;
    AudioContext.prototype.createBufferSource = function(...args) {
      const source = createSource.apply(this, args);
      // Keep cancellation tests independent of real audio time and runner speed.
      if (holdRecordings) source.playbackRate.value = 0.01;
      const id = ++nextId;
      const start = source.start.bind(source);
      const stop = source.stop.bind(source);
      source.start = (...startArgs) => {
        window.recordedCues.started.push({ id, url: decodedUrls.get(source.buffer), duration: source.buffer?.duration });
        return start(...startArgs);
      };
      source.stop = (...stopArgs) => {
        window.recordedCues.stopped.push(id);
        return stop(...stopArgs);
      };
      return source;
    };
    const createTone = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function(...args) {
      window.recordedCues.tones++;
      return createTone.apply(this, args);
    };
    // Recordings must work even when this device has no Albanian system voice.
    const synth = new EventTarget();
    synth.getVoices = () => [{ name: 'English voice', lang: 'en-US' }];
    synth.cancel = () => {};
    synth.speak = utterance => window.recordedCues.spoken.push(utterance.text);
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  }, { holdRecordings });
}

async function preparePausedClock(page) {
  await page.clock.install({ time: new Date('2026-10-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-05T12:00:01Z'));
}

const countdownUrls = [5, 4, 3, 2, 1].map(number => `/audio/countdown/sq-${number}.wav`);

test('all phases transition automatically, completion and restart work', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const phases = [
    [60000, 'Mbaje frymën', '00:30', 1],
    [30000, 'Relax – merr frymë normalisht', '00:20', 1],
    [20000, 'Merr dhe nxirr frymën', '02:00', 2],
    [120000, 'Mbaje frymën', '01:00', 2],
    [60000, 'Relax – merr frymë normalisht', '00:20', 2],
    [20000, 'Merr dhe nxirr frymën', '03:00', 3],
    [180000, 'Mbaje frymën', '02:00', 3],
  ];
  for (const [duration, label, time, round] of phases) {
    await page.clock.fastForward(duration);
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await expect(page.getByTestId('timer')).toHaveText(time);
    await expect(page.locator('.round-pill')).toContainText(`Raundi ${round}`);
  }
  await page.clock.fastForward(120000);
  await expect(page.getByRole('heading', { name: 'Seanca përfundoi' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuenow', '100');
  await page.getByRole('button', { name: 'Start përsëri' }).click();
  await expect(page.getByTestId('timer')).toHaveText('01:00');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test('pause, resume, reset, background catch-up and countdown are precise', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(12500);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('timer')).toHaveText('00:48');
  await page.clock.fastForward(90000);
  await expect(page.getByTestId('timer')).toHaveText('00:48');
  await page.getByRole('button', { name: 'Vazhdo' }).click();
  await page.clock.fastForward(42500);
  for (const [number, word] of [[5,'PESË'],[4,'KATËR'],[3,'TRE'],[2,'DY'],[1,'NJË']]) {
    await expect(page.getByTestId('timer')).toHaveText(String(number));
    await expect(page.locator('.timer-caption')).toHaveText(word);
    await page.clock.runFor(1000);
  }
  await expect(page.getByRole('heading', { name: 'Mbaje frymën', exact: true })).toBeVisible();
  await page.clock.fastForward(255000);
  await expect(page.locator('.round-pill')).toContainText('Raundi 3');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('timer')).toHaveText('01:00');
  await page.clock.fastForward(90000);
  await expect(page.getByTestId('timer')).toHaveText('01:00');
});

test('music is opt-in, loops, adjusts volume and operates independently', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  await page.getByRole('button', { name: 'Nise muzikën' }).click();
  await expect(page.locator('.music-state')).toContainText('Duke luajtur');
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0.1);
  await expect(page.getByTestId('timer')).toHaveText('01:00');
  await page.getByRole('slider', { name: 'Volumi i muzikës' }).fill('0.72');
  expect(await page.locator('audio').evaluate(audio => audio.volume)).toBe(0.72);
  expect(await page.locator('audio').evaluate(audio => audio.loop)).toBe(true);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(false);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(false);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Ndal muzikën' }).click();
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.reload();
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  await expect(page.getByRole('slider')).toHaveValue('0.72');
  expect(errors).toEqual([]);
});

test.describe('fallback when bundled recordings cannot be loaded', () => {
  test.use({ serviceWorkers: 'block' });
  for (const lang of ['en-US', 'sq-AL']) {
  test(`countdown uses only a matching Albanian voice (${lang})`, async ({ page }) => {
    await page.route('**/audio/countdown/*.wav', route => route.fulfill({ status: 404, body: '' }));
    await page.addInitScript((language) => {
      const synth = new EventTarget();
      window.spoken = [];
      synth.getVoices = () => [{ name: 'Test voice', lang: language }];
      synth.cancel = () => {};
      synth.speak = utterance => window.spoken.push({ text: utterance.text, lang: utterance.lang, voiceLang: utterance.voice.lang });
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      window.toneCount = 0;
      const create = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function() { window.toneCount++; return create.call(this); };
    }, lang);
    await preparePausedClock(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.fastForward(55000);
    await page.clock.runFor(4000);
    const spoken = await page.evaluate(() => window.spoken);
    if (lang === 'sq-AL') {
      expect(spoken.map(utterance => utterance.text)).toEqual(['pesë','katër','tre','dy','një']);
      expect(spoken.every(utterance => utterance.lang === 'sq-AL' && utterance.voiceLang === 'sq-AL')).toBe(true);
      expect(await page.evaluate(() => window.toneCount)).toBe(0);
    } else {
      expect(spoken).toEqual([]);
      expect(await page.evaluate(() => window.toneCount)).toBe(5);
    }
    // Allow one UI refresh after the exact boundary (refresh interval is 80ms).
    await page.clock.runFor(1080);
    await expect(page.getByRole('heading', { name: 'Mbaje frymën', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.toneCount)).toBe(lang === 'sq-AL' ? 2 : 7);
    await page.getByRole('switch', { name: 'Zëri shqip' }).click();
    await page.clock.fastForward(25000);
    await expect(page.getByTestId('timer')).toHaveText('5');
    expect(await page.evaluate(() => window.spoken.length)).toBe(lang === 'sq-AL' ? 5 : 0);
    expect(await page.evaluate(() => window.toneCount)).toBe(lang === 'sq-AL' ? 3 : 8);
  });
  }
});

test('all five real local recordings play in order without an installed Albanian voice', async ({ page }) => {
  await observeRecordedCountdown(page);
  await preparePausedClock(page);
  await page.goto('/');
  expect(await page.evaluate(() => window.recordedCues.started)).toEqual([]);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.audio-note')).toContainText('Numërimi shqip është gati');
  const decoded = await page.evaluate(() => window.recordedCues.decoded);
  expect(decoded.map(clip => clip.url).sort()).toEqual([...countdownUrls].sort());
  expect(decoded.every(clip => clip.duration > 0 && clip.duration < 1)).toBe(true);
  await page.clock.fastForward(55000);
  await page.clock.runFor(4000);
  const cues = await page.evaluate(() => window.recordedCues);
  expect(cues.started.map(clip => clip.url)).toEqual(countdownUrls);
  expect(cues.spoken).toEqual([]);
  expect(cues.tones).toBe(0);
  await page.clock.runFor(1080);
  await expect(page.getByRole('heading', { name: 'Mbaje frymën', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.recordedCues.tones)).toBe(2);
});

test('pause, voice OFF and reset immediately cancel the active recorded cue', async ({ page }) => {
  await observeRecordedCountdown(page, { holdRecordings: true });
  await preparePausedClock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.audio-note')).toContainText('Numërimi shqip është gati');
  await page.clock.fastForward(55000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(await page.evaluate(() => window.recordedCues.stopped)).toContain(1);
  await page.clock.fastForward(10000);
  expect(await page.evaluate(() => window.recordedCues.started.length)).toBe(1);
  await page.getByRole('button', { name: 'Vazhdo' }).click();
  // Resume creates a fresh 80ms refresh interval; allow its first boundary tick.
  await page.clock.runFor(1080);
  await expect(page.getByTestId('timer')).toHaveText('4');
  await page.getByRole('switch', { name: 'Zëri shqip' }).click();
  expect(await page.evaluate(() => window.recordedCues.stopped)).toContain(2);
  await page.clock.runFor(1000);
  await expect(page.getByTestId('timer')).toHaveText('3');
  expect(await page.evaluate(() => window.recordedCues.started.length)).toBe(2);
  expect(await page.evaluate(() => window.recordedCues.tones)).toBe(1);
  await page.getByRole('switch', { name: 'Zëri shqip' }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(await page.evaluate(() => window.recordedCues.stopped)).toContain(3);
  await page.clock.fastForward(10000);
  expect(await page.evaluate(() => window.recordedCues.started.map(clip => clip.url))).toEqual([
    '/audio/countdown/sq-5.wav', '/audio/countdown/sq-4.wav', '/audio/countdown/sq-2.wav',
  ]);
  await expect(page.getByTestId('timer')).toHaveText('01:00');
});

test('production works offline after caching, including music and Albanian recordings', async ({ page, context }) => {
  await observeRecordedCountdown(page);
  await preparePausedClock(page);
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.locator('.audio-note')).toContainText('Numërimi shqip është gati');
  await page.getByRole('button', { name: 'Nise muzikën' }).click();
  await expect(page.locator('.music-state')).toContainText('Duke luajtur');
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(false);
  await page.clock.fastForward(55000);
  await page.clock.runFor(4000);
  expect(await page.evaluate(() => window.recordedCues.started.map(clip => clip.url))).toEqual(countdownUrls);
  expect(await page.evaluate(() => window.recordedCues.spoken)).toEqual([]);
});

test('desktop and mobile render without overflow, controls work with keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await start.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
