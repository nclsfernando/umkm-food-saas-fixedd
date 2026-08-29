'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PERIOD_CHANGE_EVENT,
  PERIOD_STORAGE_KEY,
  formatPeriodLabel,
  periodQueryString,
  readStoredPeriod,
  resolvePeriod,
  writeStoredPeriod,
  yearToDateRange,
  type PeriodRange,
} from '@/lib/period';

function syncUrl(range: PeriodRange) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('from', range.from);
  url.searchParams.set('to', range.to);
  window.history.replaceState({}, '', url.toString());
}

/**
 * Shared date period across Dashboard / Biaya / Laporan / Reports.
 * Persists via `?from=&to=` and localStorage `umkm-period`.
 */
export function usePeriod() {
  const defaults = yearToDateRange();
  const [from, setFromState] = useState(defaults.from);
  const [to, setToState] = useState(defaults.to);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const range = resolvePeriod();
    setFromState(range.from);
    setToState(range.to);
    writeStoredPeriod(range);
    syncUrl(range);
    setReady(true);

    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent<PeriodRange>).detail;
      if (detail?.from && detail?.to) {
        setFromState(detail.from);
        setToState(detail.to);
      } else {
        const stored = readStoredPeriod();
        if (stored) {
          setFromState(stored.from);
          setToState(stored.to);
        }
      }
    };
    window.addEventListener(PERIOD_CHANGE_EVENT, onExternal);
    window.addEventListener('storage', (ev) => {
      if (ev.key === PERIOD_STORAGE_KEY) onExternal(ev);
    });
    return () => {
      window.removeEventListener(PERIOD_CHANGE_EVENT, onExternal);
    };
  }, []);

  const setPeriod = useCallback((nextFrom: string, nextTo: string) => {
    const range = { from: nextFrom, to: nextTo };
    setFromState(nextFrom);
    setToState(nextTo);
    writeStoredPeriod(range);
    syncUrl(range);
  }, []);

  return {
    from,
    to,
    ready,
    setFrom: (f: string) => setPeriod(f, to),
    setTo: (t: string) => setPeriod(from, t),
    setPeriod,
    label: formatPeriodLabel(from, to),
    query: periodQueryString({ from, to }),
  };
}
