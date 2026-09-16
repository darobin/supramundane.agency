// Dates are YYYY-MM-DD strings throughout: news items are days, not instants.

export function today(tz = 'Europe/Brussels') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function readableDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

export function isoDateTime(ymd) {
  return `${ymd}T12:00:00.000Z`;
}

// Partition items (sorted, each with data.date) into what shows where.
export function partition(items, ref = today()) {
  const todays = items.filter((i) => i.data.date === ref);
  const upcoming = items.filter((i) => i.data.date > ref).sort(byDate(1));
  const previously = items.filter((i) => i.data.date < ref).sort(byDate(-1));
  return { todays, upcoming, previously };
}

export function byDate(dir = -1) {
  return (a, b) => (a.data.date < b.data.date ? -dir : a.data.date > b.data.date ? dir : 0);
}
