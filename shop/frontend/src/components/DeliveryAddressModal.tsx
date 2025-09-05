import React, { useState } from 'react';
import { Modal } from './Modal';
import { postJson } from '../lib/api';

type Address = {
  streetAddress: string[];
  city: string;
  province: string;
  postalCode: string;
  country?: string;
};

type DeliveryAddressModalProps = {
  open: boolean;
  siteSlug: string;
  onClose: () => void;
  onConfirmed: (deliveryId: string) => void;
};

export const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({ open, siteSlug, onClose, onConfirmed }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [quote, setQuote] = useState<any | null>(null);

  async function getQuote() {
    setLoading(true); setError(undefined);
    try {
      const address: Address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country: 'CA' };
      const q = await postJson<any>(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone, address } });
      setQuote(q);
    } catch (e: any) {
      setError(e.message || 'Failed to get quote');
    } finally { setLoading(false); }
  }

  async function createDelivery() {
    if (!quote) return;
    setLoading(true); setError(undefined);
    try {
      const address: Address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country: 'CA' };
      const result = await postJson<any>(`/api/delivery/${siteSlug}/create`, {
        dropoff: { name, phone, address },
        manifestItems: [],
        externalId: `order-${Date.now()}`,
      });
      onConfirmed(result.id || result.delivery_id || '');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create delivery');
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delivery details">
      {error ? <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
        </label>
        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Address line 1</span>
          <input value={addr1} onChange={(e) => setAddr1(e.target.value)} />
        </label>
        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Address line 2 (optional)</span>
          <input value={addr2} onChange={(e) => setAddr2(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Province</span>
          <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="ON, BC, AB..." />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Postal Code</span>
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="A1A 1A1" />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        {!quote ? (
          <button className="primary-btn" disabled={loading} onClick={getQuote}>{loading ? 'Requesting…' : 'Get quote'}</button>
        ) : (
          <>
            <div style={{ marginRight: 'auto' }}>
              <div style={{ fontWeight: 700 }}>Estimated: {quote?.fee?.amount ? `$${(quote.fee.amount / 100).toFixed(2)}` : '—'}</div>
              {quote?.dropoff_estimated_dt ? <div className="muted" style={{ fontSize: 12 }}>ETA: {new Date(quote.dropoff_estimated_dt).toLocaleTimeString()}</div> : null}
            </div>
            <button className="primary-btn" disabled={loading} onClick={createDelivery}>{loading ? 'Creating…' : 'Confirm delivery'}</button>
          </>
        )}
      </div>
    </Modal>
  );
};

