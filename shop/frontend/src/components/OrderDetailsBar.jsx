import React from 'react';

export const OrderDetailsBar = ({
  orderType = 'Select an order type',
  pickupDate,
  pickupTime,
  addressSummary,
  onChangeOrderType,
  onPickupDateChange,
  onPickupTimeChange,
  dateOptions = [],
  timeOptions = [],
  locations = [],
  selectedLocationIndex,
  onChangeLocation,
  // New props for inline delivery address autocomplete
  showAddressInput = false,
  addressInput,
  onAddressInputChange,
  AddressAutocomplete,
  siteSlug,
  onAddressSelected,
  minutesUntilReady,
}) => {
  const selectedDateLabel = React.useMemo(() => {
    try {
      const arr = Array.isArray(dateOptions) ? dateOptions : [];
      const found = arr.find((d) => String(d.value) === String(pickupDate));
      if (found && found.label) return found.label;
      if (pickupDate) {
        const [yr, mo, dy] = String(pickupDate).split('-').map(Number);
        const d = new Date(yr, (mo || 1) - 1, dy || 1);
        const weekday = d.toLocaleDateString([], { weekday: 'long' });
        const month = d.toLocaleDateString([], { month: 'short' });
        const day = d.getDate();
        return `${weekday} (${month} ${day})`;
      }
    } catch {}
    return '';
  }, [dateOptions, pickupDate]);
  return (
    <div className="order-bar card animate-fadeInUp" role="region" aria-label="Order Details">
      <div className="order-bar__row">
        <div className="order-bar__group">
          <div className="order-bar__label">Order Details</div>
          <button className="order-bar__input" onClick={onChangeOrderType} style={{ padding: '6px 10px', minHeight: 36 }}>
            <span>{orderType}</span>
            <span className="chev">▾</span>
          </button>
          {/* Delivery Address moved under Delivery/Takeout for better alignment */}
          {showAddressInput && AddressAutocomplete ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Delivery Address</span>
              <div style={{ flex: 1 }}>
                <AddressAutocomplete
                  siteSlug={siteSlug}
                  value={addressInput}
                  onChange={onAddressInputChange}
                  onSelect={(addr, summary) => onAddressSelected && onAddressSelected(addr, summary)}
                  placeholder="Address"
                  country="CA"
                />
              </div>
            </label>
          ) : null}
        </div>
        <div className="order-bar__group">
          <div className="order-bar__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Order Date and Time</span>
            {typeof minutesUntilReady === 'number' && minutesUntilReady >= 0 ? (
              <span className="muted" style={{ fontSize: 12, color: 'var(--primary-600)' }}>{minutesUntilReady} mins</span>
            ) : null}
          </div>
          <div className="order-bar__inline" style={{ gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Day</span>
              <select
                value={pickupDate}
                onChange={(e) => onPickupDateChange && onPickupDateChange(e.target.value)}
                className="order-bar__input"
                style={{ padding: '6px 10px', borderRadius: 8, width: '100%' }}
              >
                {(dateOptions.length ? dateOptions : [
                  { value: 'today', label: 'Today' },
                  { value: 'tomorrow', label: 'Tomorrow' },
                ]).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Time</span>
              <select
                value={pickupTime}
                onChange={(e) => onPickupTimeChange && onPickupTimeChange(e.target.value)}
                className="order-bar__input"
                style={{ padding: '6px 10px', borderRadius: 8, width: '100%' }}
              >
                {(timeOptions.length ? timeOptions : (() => {
                  const out = [];
                  let h = 10, m = 0; // 10:00 AM to 10:00 PM opening
                  // last order 9:45 PM
                  let endH = 21, endM = 45;
                  while (h < endH || (h === endH && m <= endM)) {
                    const mod = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 === 0 ? 12 : h % 12;
                    const label = `${h12}:${String(m).padStart(2,'0')} ${mod}`;
                    out.push({ value: label, label });
                    m += 15; if (m >= 60) { m -= 60; h += 1; }
                  }
                  return out;
                })()).map((t) => (
                  <option key={(t.value || t)} value={(t.value || t)} disabled={!!t.disabled}>{t.label || t}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
      {Array.isArray(locations) && locations.length > 0 ? (
        <label style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>Restaurant Location</span>
          <select
            className="order-bar__input"
            aria-label="Select restaurant location"
            value={(typeof selectedLocationIndex === 'number' && selectedLocationIndex >= 0) ? String(selectedLocationIndex) : ''}
            onChange={(e) => onChangeLocation && onChangeLocation(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 8, width: '100%' }}
          >
            {(typeof selectedLocationIndex !== 'number' || selectedLocationIndex < 0) ? (
              <option value="" disabled>Select a location</option>
            ) : null}
            {locations.map((loc, idx) => {
              const text = `${loc?.name || 'Restaurant'} — ${(loc?.address?.streetAddress || []).join(' ')}, ${loc?.address?.city || ''}`;
              return (
                <option key={`${loc?.name || 'loc'}-${idx}`} value={String(idx)}>{text}</option>
              );
            })}
          </select>
        </label>
      ) : (addressSummary ? (
        <div className="muted" style={{ marginTop: 8, textAlign: 'left', fontSize: 12 }}>
          <strong style={{ color: 'var(--text)', fontWeight: 700 }}>Restaurant Location</strong>
          <span> — {addressSummary}</span>
        </div>
      ) : null)}
    </div>
  );
};

