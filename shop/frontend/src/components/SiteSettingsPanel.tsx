import React from 'react';
import { fetchJsonAllowError, patchJson } from '../lib/api';
import type { Site } from '../types';

type Props = {
  site?: Site;
  selectedSiteId: string;
  onSiteUpdated: (updated: Site) => void;
};

export const SiteSettingsPanel: React.FC<Props> = ({ site, selectedSiteId, onSiteUpdated }) => {
  const [pickupName, setPickupName] = React.useState(site?.pickup?.name || '');
  const [pickupPhone, setPickupPhone] = React.useState(site?.pickup?.phone || '');
  const [addr1, setAddr1] = React.useState(site?.pickup?.address?.streetAddress?.[0] || '');
  const [addr2, setAddr2] = React.useState(site?.pickup?.address?.streetAddress?.[1] || '');
  const [city, setCity] = React.useState(site?.pickup?.address?.city || '');
  const [province, setProvince] = React.useState(site?.pickup?.address?.province || '');
  const [postalCode, setPostalCode] = React.useState(site?.pickup?.address?.postalCode || '');
  const [country, setCountry] = React.useState(site?.pickup?.address?.country || 'CA');
  const [uberCustomerId, setUberCustomerId] = React.useState(site?.uberCustomerId || '');
  const [brandColor, setBrandColor] = React.useState(site?.brandColor || '#0ea5e9');
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [testingUber, setTestingUber] = React.useState(false);
  const [uberStatus, setUberStatus] = React.useState<{ ok: boolean; message: string } | null>(null);

  React.useEffect(() => {
    setPickupName(site?.pickup?.name || '');
    setPickupPhone(site?.pickup?.phone || '');
    setAddr1(site?.pickup?.address?.streetAddress?.[0] || '');
    setAddr2(site?.pickup?.address?.streetAddress?.[1] || '');
    setCity(site?.pickup?.address?.city || '');
    setProvince(site?.pickup?.address?.province || '');
    setPostalCode(site?.pickup?.address?.postalCode || '');
    setCountry(site?.pickup?.address?.country || 'CA');
    setUberCustomerId(site?.uberCustomerId || '');
    setBrandColor(site?.brandColor || '#0ea5e9');
  }, [site?._id]);

  if (!site) return <div className="muted">Select a site to configure.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Pickup name</span>
        <input value={pickupName} onChange={(e) => setPickupName(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Pickup phone</span>
        <input value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} placeholder="+1..." />
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
        <span>State/Province</span>
        <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="ON, BC, AB..." />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Postal Code</span>
        <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Country</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="CA">Canada (CA)</option>
          <option value="US">United States (US)</option>
          <option value="IN">India (IN)</option>
          <option value="GB">United Kingdom (GB)</option>
          <option value="AU">Australia (AU)</option>
        </select>
      </label>
      <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Uber Customer ID</span>
        <input value={uberCustomerId} onChange={(e) => setUberCustomerId(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Brand color</span>
        <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
      </label>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button disabled={testingUber} onClick={async () => {
            setTestingUber(true);
            setUberStatus(null);
            try {
              const res = await fetchJsonAllowError<any>(`/api/admin/sites/${site._id}/health`);
              if (res.ok) {
                setUberStatus({ ok: true, message: `Uber OK${res.eta ? ` · ETA ${new Date(res.eta).toLocaleTimeString()}` : ''}` });
              } else {
                setUberStatus({ ok: false, message: `Uber error: ${res.error}` });
              }
            } catch (e: any) {
              setUberStatus({ ok: false, message: e?.message || 'Uber error' });
            } finally {
              setTestingUber(false);
            }
          }}>{testingUber ? 'Testing…' : 'Test Uber'}</button>
          {uberStatus ? (
            <div style={{ fontSize: 12, color: uberStatus.ok ? 'var(--green-600)' : 'var(--red-600)' }}>{uberStatus.message}</div>
          ) : null}
        </div>
        {savedAt ? <div className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>Saved {new Date(savedAt).toLocaleTimeString()}</div> : null}
        <button className="primary-btn" disabled={saving} onClick={async () => {
          setSaving(true);
          const payload: Partial<Site> = {
            uberCustomerId,
            brandColor,
            pickup: {
              name: pickupName,
              phone: pickupPhone,
              address: {
                streetAddress: [addr1, ...(addr2 ? [addr2] : [])],
                city,
                province,
                postalCode,
                country,
              }
            }
          } as any;
          const updated = await patchJson<Site>(`/api/admin/sites/${selectedSiteId}`, payload);
          onSiteUpdated(updated);
          setSaving(false);
          setSavedAt(Date.now());
        }}>{saving ? 'Saving…' : 'Save settings'}</button>
      </div>
    </div>
  );
};

