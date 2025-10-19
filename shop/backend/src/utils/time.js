// Utilities for formatting dates consistently in a Canada time zone

// Try to infer a Canadian IANA time zone from site data when not explicitly set
function inferCanadaTimeZoneFromSite(siteLike) {
  try {
    const getProvince = () => {
      const fromPickup = siteLike?.pickup?.address?.province;
      if (fromPickup) return String(fromPickup).toUpperCase();
      const firstLocProv = Array.isArray(siteLike?.locations) && siteLike.locations.length
        ? siteLike.locations[0]?.address?.province
        : undefined;
      return String(firstLocProv || '').toUpperCase();
    };
    const country = String(
      siteLike?.pickup?.address?.country || siteLike?.locations?.[0]?.address?.country || ''
    ).toUpperCase();
    if (country && country !== 'CA') return undefined;
    const prov = getProvince();
    const MAP = {
      NL: 'America/St_Johns',
      NS: 'America/Halifax',
      PE: 'America/Halifax',
      NB: 'America/Halifax',
      QC: 'America/Toronto',
      ON: 'America/Toronto',
      MB: 'America/Winnipeg',
      SK: 'America/Regina',
      AB: 'America/Edmonton',
      BC: 'America/Vancouver',
      YT: 'America/Whitehorse',
      NT: 'America/Yellowknife',
      NU: 'America/Iqaluit',
    };
    return MAP[prov] || undefined;
  } catch {
    return undefined;
  }
}

export function resolveSiteTimeZone(siteLike) {
  const explicit = String(siteLike?.timeZone || '').trim();
  if (explicit) return explicit;
  const inferred = inferCanadaTimeZoneFromSite(siteLike);
  // Prefer Alberta time by default so MDT/MST shows for AB sites
  return inferred || 'America/Edmonton';
}

export function formatDateTimeInSiteTz(dateInput, siteLike, options = {}) {
  try {
    const tz = resolveSiteTimeZone(siteLike);
    const d = new Date(dateInput);
    const baseFmt = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: tz,
      ...(options.forceMdtLabel ? {} : { timeZoneName: 'short' })
    });
    const formatted = baseFmt.format(d);
    if (options.forceMdtLabel && tz === 'America/Edmonton') {
      return `${formatted} MDT`;
    }
    return formatted;
  } catch {
    // Fallback to ISO when Intl fails
    try { return new Date(dateInput).toISOString(); } catch { return String(dateInput || ''); }
  }
}
