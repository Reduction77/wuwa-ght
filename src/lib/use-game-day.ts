import { useEffect, useState } from 'react';
import { nextGameDayDelay, todayStr } from './dates';

export function useGameDay() {
  const [day, setDay] = useState(todayStr);
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      window.clearTimeout(timer);
      setDay(todayStr());
      timer = window.setTimeout(refresh, nextGameDayDelay());
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return day;
}
