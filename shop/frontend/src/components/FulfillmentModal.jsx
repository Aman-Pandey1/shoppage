import React from 'react';
import { Modal } from './Modal';
import { getPickupImage, getDeliveryImage } from '../lib/assetFinder';

// Enhanced fulfillment modal that matches the screenshot/requirements:
// 1) User first chooses Takeout or Delivery
// 2) Then chooses "Order Now" or "Order For Later" (disabled until a type is chosen)
// 3) If Takeout: show Date/Time selectors right in this popup
// 4) If Delivery: show a single-line Google-powered address field
export const FulfillmentModal = ({
  open,
  onClose,
  siteSlug,
  AddressAutocomplete,
  // Pickup scheduling state passed from parent so it's the single source of truth
  pickupDate,
  pickupTime,
  dateOptions = [],
  timeOptions = [],
  onPickupDateChange,
  onPickupTimeChange,
  // Finalize callbacks
  onConfirmPickup, // ({ when, date, time })
  onConfirmDelivery, // ({ when, address, summary })
  selectedType: selectedTypeProp,
}) => {
  const pickupImg = getPickupImage();
  const deliveryImg = getDeliveryImage();
  const [selectedType, setSelectedType] = React.useState(selectedTypeProp || null);
  const [timing, setTiming] = React.useState(null); // 'now' | 'later'
  const [addrText, setAddrText] = React.useState('');
  const [addrObj, setAddrObj] = React.useState(null);

  React.useEffect(() => {
    if (open) {
      setSelectedType(selectedTypeProp || null);
      setTiming(null);
      setAddrText('');
      setAddrObj(null);
    }
  }, [open, selectedTypeProp]);

  const canConfirmPickup = selectedType === 'pickup' && timing && pickupDate && pickupTime;
  const canConfirmDelivery = selectedType === 'delivery' && timing && (addrText && addrText.length > 0);

  function renderTypeButtons() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <button
          onClick={() => setSelectedType('pickup')}
          style={{
            padding: 8,
            borderRadius: 14,
            overflow: 'hidden',
            border: selectedType === 'pickup' ? '2px solid var(--primary-600)' : '1px solid var(--border)',
            background: selectedType === 'pickup'
              ? 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 10, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Takeout</div>
            {pickupImg ? (
              <div style={{ height: 90, display: 'grid', placeItems: 'center' }}>
                <img src={pickupImg} alt="Takeout" loading="eager" decoding="async" style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32 }}>🏪</div>
            )}
          </div>
        </button>
        <button
          onClick={() => setSelectedType('delivery')}
          style={{
            padding: 8,
            borderRadius: 14,
            overflow: 'hidden',
            border: selectedType === 'delivery' ? '2px solid var(--primary-600)' : '1px solid var(--border)',
            background: selectedType === 'delivery'
              ? 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 10, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Delivery</div>
            {deliveryImg ? (
              <div style={{ height: 90, display: 'grid', placeItems: 'center' }}>
                <img src={deliveryImg} alt="Delivery" loading="eager" decoding="async" style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32 }}>🚚</div>
            )}
          </div>
        </button>
      </div>
    );
  }

  function renderTimingButtons() {
    const disabled = !selectedType;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <button
          disabled={disabled}
          className="primary-btn"
          style={{ opacity: disabled ? 0.6 : 1 }}
          onClick={() => setTiming('now')}
        >
          Order Now
        </button>
        <button
          disabled={disabled}
          className="primary-btn"
          style={{ opacity: disabled ? 0.6 : 1 }}
          onClick={() => setTiming('later')}
        >
          Order For Later
        </button>
      </div>
    );
  }

  function renderFollowUp() {
    if (!selectedType || !timing) return null;
    if (selectedType === 'pickup') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Day</span>
            <select value={pickupDate || ''} onChange={(e) => onPickupDateChange && onPickupDateChange(e.target.value)}>
              {(Array.isArray(dateOptions) ? dateOptions : []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Time</span>
            <select value={pickupTime || ''} onChange={(e) => onPickupTimeChange && onPickupTimeChange(e.target.value)}>
              {(Array.isArray(timeOptions) ? timeOptions : []).map((t) => (
                <option key={(t.value || t)} value={t.value || t} disabled={!!t.disabled}>{t.label || t}</option>
              ))}
            </select>
          </label>
        </div>
      );
    }
    // delivery
    return (
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Delivery Address</span>
          {AddressAutocomplete ? (
            <AddressAutocomplete
              siteSlug={siteSlug}
              value={addrText}
              onChange={(t) => setAddrText(t)}
              onSelect={(addr, summary) => { setAddrObj(addr); setAddrText(summary || ''); }}
              placeholder="Address"
              country="CA"
            />
          ) : (
            <input value={addrText} onChange={(e) => setAddrText(e.target.value)} placeholder="Address" />
          )}
        </label>
        <div className="muted" style={{ fontSize: 10, textAlign: 'right' }}>powered by Google</div>
      </div>
    );
  }

  function renderFooter() {
    const canConfirm = canConfirmPickup || canConfirmDelivery;
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary-btn"
          disabled={!canConfirm}
          onClick={() => {
            if (selectedType === 'pickup' && canConfirmPickup) {
              onConfirmPickup && onConfirmPickup({ when: timing, date: pickupDate, time: pickupTime });
              onClose && onClose();
            } else if (selectedType === 'delivery' && canConfirmDelivery) {
              onConfirmDelivery && onConfirmDelivery({ when: timing, address: addrObj, summary: addrText });
              onClose && onClose();
            }
          }}
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={'Select Order Mode'} footer={renderFooter()} maxWidth={560} closeOnOverlayClick={false}>
      {renderTypeButtons()}
      {renderTimingButtons()}
      {renderFollowUp()}
    </Modal>
  );
};

