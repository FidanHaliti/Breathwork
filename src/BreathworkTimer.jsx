import { useEffect, useRef, useState } from 'react';
import { Wind, Play, Pause, RotateCcw, Volume2, Music2, Check, Leaf, ArrowUpRight, Headphones, ShieldCheck } from 'lucide-react';
import { useSessionTimer } from './useSessionTimer';
import { CueAudio, findAlbanianVoice } from './audio';
import { COUNTDOWN_WORDS, PHASE_LABELS, PHASES, TOTAL_SECONDS, formatTime } from './session';

function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function savePreference(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional storage. */ } }

export function CountdownVoice({ session, cues, voiceEnabled, onVoice }) {
  const lastCount = useRef(null);
  const previousPhase = useRef(0);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const refresh = () => {
      // Never assign a default voice: only a voice whose language is Albanian.
      cues.voice = findAlbanianVoice(synth.getVoices());
      onVoice(Boolean(cues.voice));
    };
    refresh();
    synth.addEventListener('voiceschanged', refresh);
    return () => synth.removeEventListener('voiceschanged', refresh);
  }, [cues, onVoice]);
  useEffect(() => {
    if (session.status === 'idle') {
      lastCount.current = null;
      previousPhase.current = 0;
      cues.silence();
      return;
    }
    if (session.status === 'paused') { cues.silence(); return; }
    if (session.index !== previousPhase.current) {
      previousPhase.current = session.index;
      lastCount.current = null;
      if (!document.hidden) cues.chime();
    }
    if (session.status === 'running' && session.remaining <= 5 && session.remaining > 0) {
      const key = `${session.index}:${session.remaining}`;
      if (key !== lastCount.current) {
        lastCount.current = key;
        if (!document.hidden) cues.countdown(COUNTDOWN_WORDS[session.remaining], voiceEnabled);
      }
    }
  }, [session.status, session.index, session.remaining, voiceEnabled, cues]);
  useEffect(() => { if (!voiceEnabled) cues.cancelSpeech(); }, [voiceEnabled, cues]);
  useEffect(() => {
    const silenceWhenHidden = () => { if (document.hidden) cues.silence(); };
    document.addEventListener('visibilitychange', silenceWhenHidden);
    return () => document.removeEventListener('visibilitychange', silenceWhenHidden);
  }, [cues]);
  return null;
}

export function PhaseProgress({ progress, children, phaseType, running }) {
  const circumference = 2 * Math.PI * 142;
  return <div className={`timer-orbit ${phaseType} ${running ? 'is-running' : ''}`}>
    <div className="orbit-halo" />
    <svg className="orbit-ring" viewBox="0 0 320 320" aria-hidden="true">
      <circle className="ring-track" cx="160" cy="160" r="142" />
      <circle className="ring-progress" cx="160" cy="160" r="142" strokeDasharray={circumference} strokeDashoffset={circumference * progress} />
    </svg>
    <div className="orbit-content">{children}</div>
    <div className="sr-only" role="progressbar" aria-label="Progresi i fazës" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} />
  </div>;
}

export function TimerDisplay({ session }) {
  const countdown = session.remaining <= 5 && session.remaining > 0 && session.status !== 'idle';
  return <PhaseProgress progress={session.phaseProgress} phaseType={session.phase.type} running={session.status === 'running'}>
    {session.complete ? <><div className="completion-symbol"><Check size={43} strokeWidth={1.5} /></div><span className="complete-text">Bravo, një moment<br />për veten.</span><span className="timer-caption">10:10 · SEANCË E PLOTË</span></> : <>
      <span className="timer-eyebrow">{session.status === 'paused' ? 'NË PAUZË' : countdown ? 'FAZA TJETËR PAS' : 'KOHA E MBETUR'}</span>
      <span className={countdown ? 'countdown-number' : 'timer-digits'} data-testid="timer" role="timer" aria-live="off" aria-label={`Koha e mbetur: ${formatTime(session.remaining)}`}>{countdown ? session.remaining : formatTime(session.remaining)}</span>
      <span className="timer-caption">{countdown ? COUNTDOWN_WORDS[session.remaining] : session.phase.type === 'breathing' ? 'GJEJ RITMIN TËND' : session.phase.type === 'hold' ? 'PA E DETYRUAR' : 'LËSHO TENSIONIN'}</span>
    </>}
  </PhaseProgress>;
}

export function SessionProgress({ session }) {
  return <div className="session-progress">
    <div className="progress-labels"><span>Seanca jote</span><span><strong>{formatTime(Math.floor(session.elapsed))}</strong><span className="muted"> / {formatTime(TOTAL_SECONDS)}</span></span></div>
    <div className="progress-track" role="progressbar" aria-label="Progresi i seancës" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(session.totalProgress * 100)}><span style={{ width: `${session.totalProgress * 100}%` }} /></div>
  </div>;
}

export function AudioControls({ volume, setVolume, voiceEnabled, setVoiceEnabled, hasVoice, recordingState }) {
  const music = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  useEffect(() => { if (music.current) music.current.volume = volume; }, [volume]);
  useEffect(() => { const audio = music.current; return () => { request.current++; audio?.pause(); }; }, []);
  const startMusic = async () => {
    const id = ++request.current;
    setLoading(true); setMusicError('');
    try {
      const audio = music.current;
      audio.volume = volume;
      await audio.play();
      if (id !== request.current) return;
      setPlaying(true);
    } catch { if (id === request.current) { setPlaying(false); setMusicError('Muzika nuk u hap. Provo sërish.'); } }
    finally { if (id === request.current) setLoading(false); }
  };
  const stopMusic = () => { request.current++; music.current.pause(); setPlaying(false); setLoading(false); };
  const voiceNote = !voiceEnabled ? 'Numërim vizual me beep të shkurtër. Zëri është i fikur.'
    : recordingState === 'ready' ? 'Numërimi shqip është gati: pesë, katër, tre, dy, një. Audio lokale, edhe offline.'
    : recordingState === 'loading' ? 'Po përgatitet numërimi shqip…'
    : recordingState === 'idle' ? 'Numërim shqip me audio lokale. Zëri përgatitet kur shtyp Start.'
    : hasVoice ? 'Audio lokale nuk u hap. Numërimi përdor zërin shqip të pajisjes.'
    : 'Audio shqip nuk u hap. Numërimi shoqërohet me beep të shkurtër.';
  return <section className="audio-panel" aria-label="Kontrollet e audios">
    <audio ref={music} src={import.meta.env.VITE_AMBIENT_AUDIO || '/audio/ambient.wav'} loop preload="none" onError={() => { setPlaying(false); setMusicError('Muzika nuk u hap. Provo sërish.'); }} />
    <div className="music-heading"><span className="audio-icon"><Headphones size={20} strokeWidth={1.6} /></span><div><h2>Pak më shumë qetësi</h2><p>Valë të buta, në sfondin tënd.</p></div><span className={`music-state ${playing ? 'active' : ''}`}><i />{playing ? 'Duke luajtur' : 'Muzika OFF'}</span></div>
    <div className="audio-controls">
      <div className="music-buttons"><button className="audio-button" onClick={startMusic} disabled={playing || loading}><Music2 size={15} />{loading ? 'Duke hapur…' : 'Nise muzikën'}</button><button className="audio-button stop-music" onClick={stopMusic} disabled={!playing && !loading}><Pause size={14} />Ndal muzikën</button></div>
      <label className="volume-control"><Volume2 size={17} /><span className="sr-only">Volumi i muzikës</span><input aria-label="Volumi i muzikës" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><span>{Math.round(volume * 100)}%</span></label>
      <div className="voice-control"><span>Zëri shqip</span><button type="button" role="switch" aria-label="Zëri shqip" aria-checked={voiceEnabled} className={`switch ${voiceEnabled ? 'on' : ''}`} onClick={() => setVoiceEnabled(!voiceEnabled)}><span /></button><span className="switch-label">{voiceEnabled ? 'ON' : 'OFF'}</span></div>
    </div>
    <p className="audio-note" role="status">{musicError || voiceNote}</p>
  </section>;
}

export function SessionOverview({ session }) {
  return <section className="session-overview" aria-labelledby="overview-heading">
    <div className="section-heading"><h2 id="overview-heading">Rruga e frymëmarrjes</h2><span>3 raunde · 10 min 10 sek</span></div>
    <div className="round-grid">{[1, 2, 3].map((round) => {
      const active = !session.complete && session.phase.round === round;
      const done = session.complete || session.phase.round > round;
      return <article className={`round-card ${active ? 'active-round' : ''} ${done ? 'done-round' : ''}`} key={round} aria-label={`Raundi ${round}${active ? ', aktiv' : done ? ', i përfunduar' : ''}`}>
        <div className="round-heading"><span className="round-number">{done ? <Check size={16} /> : `0${round}`}</span><h3>Raundi {round}</h3>{active ? <span className="round-tag">{session.status === 'idle' ? 'Fillimi' : 'Aktiv'}</span> : done ? <span className="round-tag">Përfunduar</span> : <ArrowUpRight size={16} className="round-arrow" />}</div>
        <ul>{PHASES.map((phase, index) => ({ ...phase, index })).filter((phase) => phase.round === round).map((phase) => <li key={phase.index} className={session.index === phase.index && !session.complete ? 'active-phase' : ''}><span className="phase-dot" /><span>{phase.type === 'breathing' ? 'Frymëmarrje' : phase.type === 'hold' ? 'Mbajtje e frymës' : 'Relax'}</span><span className="phase-duration">{phase.duration}s</span></li>)}</ul>
      </article>;
    })}</div>
  </section>;
}

export default function BreathworkTimer() {
  const { session, start, pause, reset } = useSessionTimer();
  const [volume, updateVolume] = useState(() => { const value = readPreference('breathwork.volume', 0.35); return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.35; });
  const [voiceEnabled, updateVoice] = useState(() => readPreference('breathwork.voice', true) === true);
  const [hasVoice, setHasVoice] = useState(false);
  const [recordingState, setRecordingState] = useState('idle');
  const cues = useRef(null);
  if (!cues.current) cues.current = new CueAudio(setRecordingState);
  useEffect(() => () => cues.current.dispose(), []);
  const setVolume = (value) => { updateVolume(value); savePreference('breathwork.volume', value); };
  const setVoiceEnabled = (value) => { updateVoice(value); savePreference('breathwork.voice', value); };
  const begin = () => { cues.current.unlock(); start(); };
  const doPause = () => { cues.current.silence(); pause(); };
  const doReset = () => { cues.current.silence(); reset(); };
  return <div className="app-shell">
    <CountdownVoice session={session} cues={cues.current} voiceEnabled={voiceEnabled} onVoice={setHasVoice} />
    <header className="site-header"><a className="brand" href="/" aria-label="Breathwork, kryefaqja"><span className="brand-icon"><Wind size={23} strokeWidth={1.7} /></span>breathwork<span className="brand-period">.</span></a><span className="header-note"><Leaf size={14} /> Një moment për veten</span></header>
    <main>
      <div className="intro"><span className="eyebrow">FRYMËMARRJE E VETËDIJSHME</span><h1>Një frymë në një kohë.</h1><p>Gjej një vend të rehatshëm. Lëre pjesën tjetër të presë.</p></div>
      <section className="timer-section" aria-label="Timeri i frymëmarrjes">
        <div className="phase-header"><span className="round-pill">{session.complete ? <Check size={13} /> : <span className="live-dot" />}{session.complete ? '3 raunde të përfunduara' : `Raundi ${session.phase.round} nga 3`}</span><h2 aria-live="polite" aria-atomic="true">{session.complete ? 'Seanca përfundoi' : PHASE_LABELS[session.phase.type]}</h2></div>
        <TimerDisplay session={session} />
        <div className="timer-actions"><button className="primary-button" onClick={session.status === 'running' ? doPause : begin}>{session.status === 'running' ? <Pause size={18} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{session.status === 'running' ? 'Pause' : session.status === 'paused' ? 'Vazhdo' : session.complete ? 'Start përsëri' : 'Start'}</button><button className="reset-button" onClick={doReset} disabled={session.status === 'idle'}><RotateCcw size={17} />Reset</button></div>
        <p className="timer-hint">{session.complete ? 'Merr frymë normalisht dhe shijo qetësinë.' : session.status === 'paused' ? 'Merr kohën tënde. Vazhdo kur të jesh gati.' : 'Ndiq ritmin tënd. Fazat kalojnë automatikisht.'}</p>
        <span className="sr-only" role="status">{session.status === 'paused' ? 'Seanca në pauzë' : session.status === 'running' ? 'Seanca vazhdon' : ''}</span>
        <SessionProgress session={session} />
      </section>
      <SessionOverview session={session} />
      <AudioControls volume={volume} setVolume={setVolume} voiceEnabled={voiceEnabled} setVoiceEnabled={setVoiceEnabled} hasVoice={hasVoice} recordingState={recordingState} />
      <aside className="safety-note"><ShieldCheck size={20} strokeWidth={1.5} /><p>Mos e detyro mbajtjen e frymës. Nëse ndjen marramendje, parehati ose nevojë për të marrë frymë, ndalo mbajtjen dhe merr frymë normalisht. Mos e praktiko gjatë vozitjes ose në ujë.</p></aside>
    </main>
    <footer><span>Frymëmarrje. Hapësirë. Qetësi.</span><span>Me kujdes, për veten.</span></footer>
  </div>;
}
