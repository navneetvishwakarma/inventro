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
