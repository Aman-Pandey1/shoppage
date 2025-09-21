import React from 'react';

export const OrderDetailsBar = ({
  orderType = 'Select an order type',
  pickupDate = 'Today',
  pickupTime = '10:00 AM',
  addressSummary,
  onChangeOrderType,
  onChangePickupDate,
  onChangePickupTime,
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
          <div className="order-bar__inline">
            <button className="order-bar__input" onClick={onChangePickupDate}>
              <span>{pickupDate}</span>
              <span className="chev">▾</span>
            </button>
            <button className="order-bar__input" onClick={onChangePickupTime}>
              <span>{pickupTime}</span>
              <span className="chev">▾</span>
            </button>
          </div>
        </div>
      </div>
      {addressSummary ? (
        <div className="muted" style={{ marginTop: 8, textAlign: 'left', fontSize: 12 }}>{addressSummary}</div>
      ) : null}
    </div>
  );
};

