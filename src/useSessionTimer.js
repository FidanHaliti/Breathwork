import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionClock } from './session';

export function useSessionTimer(phases) {
  const clock = useRef(null);
  if (!clock.current) clock.current = new SessionClock(undefined, phases);
  const [session, setSession] = useState(() => clock.current.snapshot());
  const refresh = useCallback(() => setSession(clock.current.snapshot()), []);
  const start = useCallback(() => { clock.current.start(); refresh(); }, [refresh]);
  const pause = useCallback(() => { clock.current.pause(); refresh(); }, [refresh]);
  const reset = useCallback(() => { clock.current.reset(); refresh(); }, [refresh]);
  useEffect(() => {
    if (session.status !== 'running') return;
    const id = window.setInterval(refresh, 80);
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', refresh);
    };
  }, [session.status, refresh]);
  const configure = useCallback((nextPhases) => { clock.current.configure(nextPhases); refresh(); }, [refresh]);
  return { session, start, pause, reset, configure };
}
