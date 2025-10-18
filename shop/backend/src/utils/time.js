// Utilities for formatting dates consistently in a Canada time zone

export function resolveSiteTimeZone(siteLike) {
  const tz = String(siteLike?.timeZone || '').trim();
  // Fallback to Toronto if not configured; adjust via admin settings per site
  return tz || 'America/Toronto';
}

export function formatDateTimeInSiteTz(dateInput, siteLike) {
  try {
    const tz = resolveSiteTimeZone(siteLike);
    const d = new Date(dateInput);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: tz, timeZoneName: 'short'
    });
    return fmt.format(d);
  } catch {
    // Fallback to ISO when Intl fails
    try { return new Date(dateInput).toISOString(); } catch { return String(dateInput || ''); }
  }
}
