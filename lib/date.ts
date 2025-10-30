// src/lib/date.ts

export type Range = { from: Date; to: Date };

/** helper: Start des Tages (UTC 00:00) */
export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** plus N Tage */
export function addDaysUTC(d: Date, n: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

/** Start des Monats (UTC) */
export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** plus N Monate */
export function addMonthsUTC(d: Date, n: number): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  copy.setUTCMonth(copy.getUTCMonth() + n);
  return copy;
}

/** YYYY-MM-DD */
export function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * parseRangeFromSearch:
 * Liest entweder ?from=YYYY-MM-DD&to=YYYY-MM-DD oder ?preset=mtd/qtd/ytd/last30/vormonat
 * und gibt ein {from,to} zurück.
 */
export function parseRangeFromSearch(
  searchParams: Record<string, string | string[] | undefined>
): Range {
  const sp = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const preset = sp('preset');
  const fromParam = sp('from');
  const toParam = sp('to');

  // helper "today" in UTC
  const now = new Date();
  const todayUTC = startOfDayUTC(now);

  function rangeLast30() {
    const to = addDaysUTC(todayUTC, 1); // exclusive
    const from = addDaysUTC(todayUTC, -30);
    return { from, to };
  }

  function rangeMTD() {
    const monthStart = startOfMonthUTC(todayUTC);
    const to = addDaysUTC(todayUTC, 1);
    return { from: monthStart, to };
  }

  function rangeYTD() {
    const yStart = new Date(Date.UTC(todayUTC.getUTCFullYear(), 0, 1));
    const to = addDaysUTC(todayUTC, 1);
    return { from: yStart, to };
  }

  function rangePrevMonth() {
    const firstThis = startOfMonthUTC(todayUTC);
    const firstPrev = addMonthsUTC(firstThis, -1);
    const firstNextAfterPrev = firstThis; // so 'to' = first day of this month
    return { from: firstPrev, to: firstNextAfterPrev };
  }

  if (preset === 'last30') return rangeLast30();
  if (preset === 'mtd') return rangeMTD();
  if (preset === 'ytd') return rangeYTD();
  if (preset === 'prevmonth') return rangePrevMonth();

  if (fromParam && toParam) {
    const from = startOfDayUTC(new Date(fromParam + 'T00:00:00Z'));
    // to ist exklusiv -> also +1 Tag
    const toDay = startOfDayUTC(new Date(toParam + 'T00:00:00Z'));
    const to = addDaysUTC(toDay, 1);
    return { from, to };
  }

  // fallback: last30
  return rangeLast30();
}
