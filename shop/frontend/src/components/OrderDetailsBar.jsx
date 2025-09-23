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
}) => {
  return (
    <div className="order-bar card animate-fadeInUp" role="region" aria-label="Order details">
      <div className="order-bar__row">
        <div className="order-bar__group">
          <div className="order-bar__label">Order details</div>
          <button className="order-bar__input" onClick={onChangeOrderType}>
            <span>{orderType}</span>
            <span className="chev">▾</span>
          </button>
        </div>
        <div className="order-bar__group">
          <div className="order-bar__label">Pickup time</div>
          <div className="order-bar__inline" style={{ gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Day</span>
              <select
                value={pickupDate}
                onChange={(e) => onPickupDateChange && onPickupDateChange(e.target.value)}
                className="order-bar__input"
                style={{ padding: '6px 10px', borderRadius: 8 }}
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
                style={{ padding: '6px 10px', borderRadius: 8 }}
              >
                {(timeOptions.length ? timeOptions : (() => {
                  const out = [];
                  let h = 10, m = 0; // 10:00 AM to 10:00 PM
                  while (h < 22 || (h === 22 && m === 0)) {
                    const mod = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 === 0 ? 12 : h % 12;
                    const label = `${h12}:${String(m).padStart(2,'0')} ${mod}`;
                    out.push({ value: label, label });
                    m += 45; if (m >= 60) { m -= 60; h += 1; }
                  }
                  return out;
                })()).map((t) => (
                  <option key={t.value || t} value={t.value || t}>{t.label || t}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
      {addressSummary ? (
        <div className="muted" style={{ marginTop: 8, textAlign: 'left', fontSize: 12 }}>{addressSummary}</div>
      ) : null}
    </div>
  );
};

