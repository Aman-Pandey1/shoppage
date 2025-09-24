import React from 'react';
import { fetchJsonAllowError, patchJson } from '../lib/api';
import { Modal } from './Modal';

export const SiteSettingsPanel = ({ site, selectedSiteId, onSiteUpdated }) => {
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
  const [locations, setLocations] = React.useState(Array.isArray(site?.locations) ? site.locations : []);
  const [cities, setCities] = React.useState(Array.isArray(site?.cities) ? site.cities : []);
  const [deliveryFee, setDeliveryFee] = React.useState(((Number(site?.deliveryFeeCents)||0)/100).toFixed(2));
  const [logoUrl, setLogoUrl] = React.useState(site?.logoUrl || '');
  const [logoFile, setLogoFile] = React.useState(null);
  const [hours, setHours] = React.useState(site?.hours || {
    mon: { open: '10:00', close: '22:00', closed: false },
    tue: { open: '10:00', close: '22:00', closed: false },
    wed: { open: '10:00', close: '22:00', closed: false },
    thu: { open: '10:00', close: '22:00', closed: false },
    fri: { open: '10:00', close: '22:00', closed: false },
    sat: { open: '10:00', close: '22:00', closed: false },
    sun: { open: '10:00', close: '22:00', closed: false },
  });
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const [testingUber, setTestingUber] = React.useState(false);
  const [uberStatus, setUberStatus] = React.useState(null);

  // Location modal state
  const [isLocFormOpen, setIsLocFormOpen] = React.useState(false);
  const [editingLocIndex, setEditingLocIndex] = React.useState(null);
  const [locForm, setLocForm] = React.useState({ name: '', phone: '', addr1: '', addr2: '', city: '', province: '', postalCode: '', country: 'CA' });

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
    setLocations(Array.isArray(site?.locations) ? site.locations : []);
    setCities(Array.isArray(site?.cities) ? site.cities : []);
    setDeliveryFee(((Number(site?.deliveryFeeCents)||0)/100).toFixed(2));
    setHours(site?.hours || {
      mon: { open: '10:00', close: '22:00', closed: false },
      tue: { open: '10:00', close: '22:00', closed: false },
      wed: { open: '10:00', close: '22:00', closed: false },
      thu: { open: '10:00', close: '22:00', closed: false },
      fri: { open: '10:00', close: '22:00', closed: false },
      sat: { open: '10:00', close: '22:00', closed: false },
      sun: { open: '10:00', close: '22:00', closed: false },
    });
    setLogoUrl(site?.logoUrl || '');
    setLogoFile(null);
  }, [site?._id]);

  if (!site) return <div className="muted">Select a site to configure.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={{ gridColumn: '1 / -1', fontWeight: 800 }}>Pickup locations</div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
        {(locations || []).map((loc, idx) => (
          <div key={idx} className="card" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{loc.name || 'Restaurant'}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {(loc.address?.streetAddress || []).join(' ')}, {loc.address?.city}, {loc.address?.province} {loc.address?.postalCode}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                setEditingLocIndex(idx);
                setLocForm({
                  name: loc.name || '',
                  phone: loc.phone || '',
                  addr1: loc.address?.streetAddress?.[0] || '',
                  addr2: loc.address?.streetAddress?.[1] || '',
                  city: loc.address?.city || '',
                  province: loc.address?.province || '',
                  postalCode: loc.address?.postalCode || '',
                  country: loc.address?.country || 'CA',
                });
                setIsLocFormOpen(true);
              }}>Edit</button>
              <button className="danger" onClick={() => setLocations(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
            </div>
          </div>
        ))}
        <button onClick={() => {
          setEditingLocIndex(null);
          setLocForm({ name: '', phone: '', addr1: '', addr2: '', city: '', province: '', postalCode: '', country: 'CA' });
          setIsLocFormOpen(true);
        }}>+ Add location</button>
      </div>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Delivery cities (for Delivery tabs)</div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
        {(cities || []).map((cityName, idx) => (
          <div key={idx} className="card" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <input value={cityName} onChange={(e) => setCities(prev => prev.map((c, i) => i === idx ? e.target.value : c))} />
            <button className="danger" onClick={() => setCities(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
          </div>
        ))}
        <button onClick={() => setCities(prev => [...prev, 'New City'])}>+ Add city</button>
      </div>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Branding</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Logo URL</span>
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Or upload logo</span>
        <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
      </label>
      {logoUrl ? (
        <div className="card" style={{ gridColumn: '1 / -1', padding: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logoUrl} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          <div className="muted" style={{ fontSize: 12 }}>Preview</div>
        </div>
      ) : null}

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Delivery settings</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Flat delivery fee (in $)</span>
        <input type="number" step="0.01" min={0} value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>Applied only to delivery orders. Not shown for pickup.</span>
      </label>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Opening hours</div>
      <div className="card" style={{ gridColumn: '1 / -1', padding: 10, display: 'grid', gap: 8 }}>
        {[
          ['mon','Monday'], ['tue','Tuesday'], ['wed','Wednesday'], ['thu','Thursday'], ['fri','Friday'], ['sat','Saturday'], ['sun','Sunday']
        ].map(([key, label]) => (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>{label}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Open</span>
              <input type="time" value={hours?.[key]?.open || ''} onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...(prev?.[key] || {}), open: e.target.value } }))} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Close</span>
              <input type="time" value={hours?.[key]?.close || ''} onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...(prev?.[key] || {}), close: e.target.value } }))} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifySelf: 'end' }}>
              <input type="checkbox" checked={!!hours?.[key]?.closed} onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...(prev?.[key] || {}), closed: e.target.checked } }))} />
              <span>Closed</span>
            </label>
          </div>
        ))}
        <div className="muted" style={{ fontSize: 12 }}>Times use 24-hour format. Defaults to 10:00–22:00.</div>
      </div>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Legacy default pickup (optional)</div>
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
              const res = await fetchJsonAllowError(`/api/admin/sites/${site._id}/health`);
              if (res.ok) {
                setUberStatus({ ok: true, message: `Uber OK${res.eta ? ` · ETA ${new Date(res.eta).toLocaleTimeString()}` : ''}` });
              } else {
                setUberStatus({ ok: false, message: `Uber error: ${res.error}` });
              }
            } catch (e) {
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
          const payload = {
            uberCustomerId,
            brandColor,
            locations,
            cities,
            deliveryFeeCents: Math.max(0, Math.round(Number(deliveryFee || 0) * 100)),
            hours,
            logoUrl,
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
          };
          let updated = await patchJson(`/api/admin/sites/${selectedSiteId}`, payload);
          if (logoFile) {
            try {
              const form = new FormData();
              form.append('file', logoFile);
              const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/admin/sites/${selectedSiteId}/logo`, {
                method: 'POST',
                headers: { ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}) },
                body: form,
              });
              if (resp.ok) {
                const data = await resp.json();
                updated = data.site || updated;
                setLogoUrl(data.logoUrl || updated.logoUrl || '');
              }
            } catch {}
          }
          onSiteUpdated(updated);
          setSaving(false);
          setSavedAt(Date.now());
        }}>{saving ? 'Saving…' : 'Save settings'}</button>
      </div>

      <Modal
        open={isLocFormOpen}
        onClose={() => setIsLocFormOpen(false)}
        title={editingLocIndex !== null ? 'Edit location' : 'Add location'}
        footer={(
          <>
            <button onClick={() => setIsLocFormOpen(false)}>Cancel</button>
            <button
              className="primary-btn"
              onClick={() => {
                const payload = {
                  name: locForm.name || 'Restaurant',
                  phone: locForm.phone || '',
                  address: {
                    streetAddress: [locForm.addr1, ...(locForm.addr2 ? [locForm.addr2] : [])],
                    city: locForm.city || '',
                    province: locForm.province || '',
                    postalCode: locForm.postalCode || '',
                    country: locForm.country || 'CA',
                  },
                };
                setLocations(prev => {
                  if (editingLocIndex !== null && editingLocIndex >= 0) {
                    return prev.map((l, i) => i === editingLocIndex ? payload : l);
                  }
                  return [...prev, payload];
                });
                setIsLocFormOpen(false);
                setEditingLocIndex(null);
              }}
            >{editingLocIndex !== null ? 'Save changes' : 'Add location'}</button>
          </>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Name</span>
            <input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Phone</span>
            <input value={locForm.phone} onChange={(e) => setLocForm({ ...locForm, phone: e.target.value })} placeholder="+1..." />
          </label>
          <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Address line 1</span>
            <input value={locForm.addr1} onChange={(e) => setLocForm({ ...locForm, addr1: e.target.value })} />
          </label>
          <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Address line 2 (optional)</span>
            <input value={locForm.addr2} onChange={(e) => setLocForm({ ...locForm, addr2: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>City</span>
            <input value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>State/Province</span>
            <input value={locForm.province} onChange={(e) => setLocForm({ ...locForm, province: e.target.value })} placeholder="ON, BC, AB..." />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Postal Code</span>
            <input value={locForm.postalCode} onChange={(e) => setLocForm({ ...locForm, postalCode: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Country</span>
            <select value={locForm.country} onChange={(e) => setLocForm({ ...locForm, country: e.target.value })}>
              <option value="CA">Canada (CA)</option>
              <option value="US">United States (US)</option>
              <option value="IN">India (IN)</option>
              <option value="GB">United Kingdom (GB)</option>
              <option value="AU">Australia (AU)</option>
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
};

