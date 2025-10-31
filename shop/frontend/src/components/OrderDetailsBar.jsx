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
  // When true, show skeleton loader instead of inputs to avoid layout jank
  loading = false,
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
  if (loading) {
    return (
      <div className="order-bar card" aria-busy="true" aria-label="Loading order details">
        <div className="order-bar__row">
          <div className="order-bar__group">
            <div className="skeleton skeleton-text" style={{ width: 100 }} />
            <div className="skeleton skeleton-input" />
          </div>
          <div className="order-bar__group">
            <div className="skeleton skeleton-text" style={{ width: 160 }} />
            <div className="order-bar__inline" style={{ gap: 8 }}>
              <div className="skeleton skeleton-input" />
              <div className="skeleton skeleton-input" />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton skeleton-text" style={{ width: 140 }} />
          <div className="skeleton skeleton-input" />
        </div>
      </div>
    );
  }

  return (
    <div className="order-bar card animate-fadeInUp" role="region" aria-label="Order Details">
      <div className="order-bar__row">
        <div className="order-bar__group">
          <div className="order-bar__pair order-bar__pair--compact">
            <div className="order-bar__label">Order Details</div>
            <button className="order-bar__input" onClick={onChangeOrderType} style={{ padding: '6px 10px', minHeight: 36 }}>
              <span>{orderType}</span>
              <span className="chev">▾</span>
            </button>
          </div>
        </div>
        <div className="order-bar__group">
          <div className="order-bar__pair" style={{ width: '100%' }}>
            <div className="order-bar__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Order Date and Time</span>
              {typeof minutesUntilReady === 'number' ? (
                <span className="order-bar__eta" style={{ color: '#ea5a4b' }}>{minutesUntilReady} mins</span>
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
      </div>
      {/* Second row: Restaurant Location (left) and Delivery Address (right) */}
      <div className="order-bar__row" style={{ marginTop: 8 }}>
        {Array.isArray(locations) && locations.length > 0 ? (
          <div className="order-bar__group">
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
          </div>
        ) : (addressSummary ? (
          <div className="order-bar__group">
            <span className="muted" style={{ fontSize: 12 }}>Restaurant Location</span>
            <div className="order-bar__input" style={{ alignItems: 'center' }}>
              <span>{addressSummary}</span>
            </div>
          </div>
        ) : null)}

        {showAddressInput && AddressAutocomplete ? (
          <div className="order-bar__group">
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
          </div>
        ) : null}
      </div>
    </div>
  );
};

