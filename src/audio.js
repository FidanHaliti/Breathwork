export function findAlbanianVoice(voices) {
  return voices.find((voice) => /^sq(?:[-_]|$)/i.test(voice.lang)) || null;
}

export const COUNTDOWN_CLIPS = {
  'PESË': '/audio/countdown/sq-5.wav',
  'KATËR': '/audio/countdown/sq-4.wav',
  'TRE': '/audio/countdown/sq-3.wav',
  'DY': '/audio/countdown/sq-2.wav',
  'NJË': '/audio/countdown/sq-1.wav',
};

export class CueAudio {
  constructor(onRecordingsState = () => {}) {
    this.context = null;
    this.voice = null;
    this.nodes = new Set();
    this.buffers = new Map();
    this.activeRecording = null;
    this.recordingState = 'idle';
    this.onRecordingsState = onRecordingsState;
    this.loading = null;
    this.loadController = null;
  }
  async loadRecordings(ctx) {
    if (this.loading) return this.loading;
    if (this.buffers.size === Object.keys(COUNTDOWN_CLIPS).length) return;
    this.recordingState = 'loading';
    this.onRecordingsState('loading');
    const controller = new AbortController();
    this.loadController = controller;
    const pending = Promise.allSettled(Object.entries(COUNTDOWN_CLIPS).map(async ([word, url]) => {
      if (this.buffers.has(word)) return;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Countdown clip unavailable');
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (this.context === ctx && !controller.signal.aborted) this.buffers.set(word, buffer);
    })).then(() => {
      if (this.context !== ctx || controller.signal.aborted) return;
      this.recordingState = this.buffers.size === Object.keys(COUNTDOWN_CLIPS).length ? 'ready' : 'unavailable';
      this.onRecordingsState(this.recordingState);
    }).finally(() => {
      if (this.loading === pending) this.loading = null;
      if (this.loadController === controller) this.loadController = null;
    });
    this.loading = pending;
    return pending;
  }
  async unlock() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { this.recordingState = 'unavailable'; this.onRecordingsState('unavailable'); return; }
      this.context ||= new AudioContext();
      const ctx = this.context;
      if (ctx.state === 'suspended') await ctx.resume();
      if (this.context === ctx) await this.loadRecordings(ctx);
    } catch { /* Visual countdown remains available without audio support. */ }
  }
  tone(frequency, offset, duration, volume) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + offset;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
  countdown(word, voiceEnabled) {
    this.cancelSpeech();
    const buffer = this.buffers.get(word);
    if (voiceEnabled && buffer && this.context?.state === 'running') {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.8;
      source.connect(gain).connect(this.context.destination);
      this.activeRecording = source;
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.activeRecording === source) this.activeRecording = null;
      };
      source.start();
      return;
    }
    if (voiceEnabled && this.voice && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(word.toLocaleLowerCase('sq-AL'));
      utterance.voice = this.voice;
      utterance.lang = 'sq-AL';
      utterance.rate = 1.1;
      utterance.volume = 0.8;
      utterance.onerror = (event) => {
        if (!['interrupted', 'canceled'].includes(event.error)) this.beep();
      };
      window.speechSynthesis.speak(utterance);
    } else this.beep();
  }
  beep() { this.tone(660, 0, 0.12, 0.075); }
  chime() { this.cancelSpeech(); this.tone(523.25, 0, 0.7, 0.09); this.tone(783.99, 0.12, 1, 0.055); }
  cancelSpeech() {
    window.speechSynthesis?.cancel();
    if (this.activeRecording) {
      try { this.activeRecording.stop(); } catch { /* Already ended. */ }
      this.activeRecording = null;
    }
  }
  silence() {
    this.cancelSpeech();
    for (const node of this.nodes) { try { node.stop(); } catch { /* Already ended. */ } }
    this.nodes.clear();
  }
  dispose() {
    this.silence();
    this.loadController?.abort();
    this.loadController = null;
    this.loading = null;
    this.buffers.clear();
    this.context?.close().catch(() => {});
    this.context = null;
    this.recordingState = 'idle';
  }
}
