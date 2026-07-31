// Single-household v1 is fixed to Asia/Kolkata (working spec Sec2 locale
// defaults) -- not read from households.timezone, same simplification the
// rest of the app makes pre-multi-tenant.
const HOUSEHOLD_TIMEZONE = 'Asia/Kolkata';

// Renders an instant as its Asia/Kolkata calendar day (YYYY-MM-DD).
// Load-bearing for the stock_epoch / past-order comparison: two instants
// on either side of midnight UTC can be the same Kolkata calendar day, and
// a naive toISOString().slice(0,10) or raw Date comparison gets that wrong.
export function toKolkataDateString(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HOUSEHOLD_TIMEZONE }).format(new Date(iso));
}

// The inverse: a plain YYYY-MM-DD (from a <input type="date">) becomes the
// instant at Kolkata midnight for that day, so toKolkataDateString of the
// stored value always round-trips back to the exact string the user typed.
export function kolkataDateStringToInstant(dateString: string): string {
  return `${dateString}T00:00:00+05:30`;
}

// S-31: [start, end) instants for the current Kolkata calendar month, used
// by Insights' spend-by-category and waste-report windows. Derived from
// today's Kolkata date (not a raw UTC month boundary, which can be off by
// one Kolkata calendar day around midnight IST -- same class of bug
// toKolkataDateString exists to avoid).
export function currentKolkataMonthRange(nowIso: string = new Date().toISOString()): { start: string; end: string } {
  const todayKolkata = toKolkataDateString(nowIso); // YYYY-MM-DD
  const [year, month] = todayKolkata.split('-').map(Number);
  const startDateString = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDateString = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start: kolkataDateStringToInstant(startDateString), end: kolkataDateStringToInstant(endDateString) };
}

// S-34: [start, end) instants for today's Kolkata calendar day -- same
// derive-from-toKolkataDateString approach as currentKolkataMonthRange, one
// day wide instead of one month, for the 100/day loop-bug guard (working
// spec Sec13) so "today" always means the Kolkata day, not a raw UTC one.
export function currentKolkataDayRange(nowIso: string = new Date().toISOString()): { start: string; end: string } {
  const start = kolkataDateStringToInstant(toKolkataDateString(nowIso));
  // IST has no DST, so exactly +24h from Kolkata midnight is always the
  // next Kolkata midnight -- no need to re-derive via toKolkataDateString.
  const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();
  return { start, end };
}
