# Breathwork Timer

A complete Albanian-language breathwork app, built with React and Vite. No account, database, or backend. Three rounds, eight phases, exactly **10:10**.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The browser suite covers all phase transitions, countdown, completion/restart, pause/resume/reset, speech eligibility, beep/chime fallback, music independence, volume/preferences, offline playback, keyboard controls, and mobile overflow.

## Deploy to Vercel

Push this folder to a GitHub repository, import that repository into Vercel, and deploy. The included `vercel.json` sets Vite, `npm run build`, and `dist`. No environment variables or server are required. Local test: `npm run preview` after building.

## Session

| Round | Breathing | Hold | Relax |
| --- | --- | --- | --- |
| 1 | 60s | 30s | 20s |
| 2 | 120s | 60s | 20s |
| 3 | 180s | 120s | — |

`src/session.js` owns the configuration and clock. A timestamp anchor measures elapsed time; UI intervals only refresh the display. Pause saves elapsed milliseconds. Hidden-tab throttling cannot add drift: the next refresh catches up to real elapsed time and can cross multiple phases. Timers and event listeners are cleaned up on unmount.

## Audio

- Music is always OFF on page load, regardless of stored preferences. Only a user click starts it. Timer start/pause/reset/completion do not stop or start music.
- `public/audio/ambient.wav` is an original, bundled 24-second stereo wave soundscape made from filtered noise. It uses no pitched oscillators. Regenerate with `python scripts/generate-ambient.py`.
- To use your own music, place it at `public/audio/ambient.mp3`, copy `.env.example` to `.env.local`, and set `VITE_AMBIENT_AUDIO=/audio/ambient.mp3`. Rebuild. Keep files local for offline use, and use a recording you have rights to use.
- With “Zëri shqip” ON, the countdown first uses five bundled spoken clips: `public/audio/countdown/sq-5.wav` through `sq-1.wav` (“pesë, katër, tre, dy, një”). These are synthetic Albanian speech generated with Microsoft's `sq-AL-AnilaNeural` voice. They do not require an installed browser voice or a network speech service during app use. Source metadata and durations are in `public/audio/countdown/source.json`.
- The five clips are decoded once after Start and kept ready for instant playback. Each lasts under one second, with trimmed silence to align it with the visual number. Pause, Reset, voice OFF, phase changes, and hiding the page stop spoken audio immediately; no pending download can trigger a stale spoken number.
- If a local clip cannot load, the countdown can use an actual browser voice with an `sq` language tag and utterance language `sq-AL`, otherwise a short beep. It never substitutes a foreign-language voice. Voice OFF uses beeps; visual countdown always works. Short sine beeps and a soft two-note transition chime remain independent of the background music.
- Asset regeneration is optional: `python -m pip install --target .audio-tools edge-tts imageio-ffmpeg`, then `python scripts/generate-countdown.py`. This one-time generation requires internet; deployment and normal app builds only use the committed WAV files. Microsoft's voice documentation: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- Local storage saves only voice ON/OFF, music volume, and the chosen light/dark theme. No microphone is used.

## Offline

Production builds generate a service worker that caches the application and all local public audio. After the first successful load and cache installation, the application can reload and play its bundled music and spoken Albanian countdown offline. Development mode has no service worker. HTTPS or localhost is required. The browser can suspend or unload background pages; the timer catches up when the page resumes, but browsers cannot guarantee sounds while suspended. Reload starts a new session; active sessions are intentionally not persisted.

## Appearance

The header's moon/sun button switches between light and dark themes without interrupting a session or its audio. The first visit follows the device's theme; an explicit choice is stored in `breathwork.theme` and applied before the page paints. If storage is blocked, switching still works for the current visit.

## Guidance and wording

The interface explains the purpose and the actions for each phase, including a practical completion prompt. The expandable “Për çfarë shërben ky ushtrim?” section links to NHS and NCCIH guidance. It distinguishes evidence about gentle, slow breathing from the app's particular 10:10 breath-holding schedule and treats hold durations as optional guidance, not targets to force.

References:
- https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/
- https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know

## Keyboard and motion

Semantic buttons support keyboard input, focus outlines are visible, switches/sliders are labeled, progress bars expose values, and phase changes use a polite live region. Seconds are not announced every tick. Reduced-motion preferences disable the breathing animation. Fonts are local system fonts, with no external downloads.

The safety message is displayed in Albanian at the bottom of the app.
