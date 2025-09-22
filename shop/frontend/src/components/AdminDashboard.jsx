import React, { useEffect, useMemo, useState } from 'react';
import { deleteJson, fetchJson, postJson, putJson, patchJson, download, postFile } from '../lib/api';
import { SiteSettingsPanel } from './SiteSettingsPanel';
import { Modal } from './Modal';

export const AdminDashboard = () => {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const [filterCategory, setFilterCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('links');
  const fileInputRef = React.useRef(null);
  const [billing, setBilling] = useState(null);
  const [todayBilling, setTodayBilling] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState();
  const [ordersFrom, setOrdersFrom] = useState('');
  const [ordersTo, setOrdersTo] = useState('');

  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: '', slug: '', domainsText: '' });

  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', imageUrl: '' });
  const [deleteCategoryId, setDeleteCategoryId] = useState(null);

  const [deleteProductId, setDeleteProductId] = useState(null);

  async function loadAll() {
    try {
      setLoading(true);
      const sitesList = await fetchJson('/api/admin/sites');
      setSites(sitesList);
      let siteId = selectedSiteId;
      if (!siteId) {
        const saved = localStorage.getItem('admin_selected_site');
        siteId = saved || sitesList[0]?._id || '';
        setSelectedSiteId(siteId);
      }
      if (!siteId) {
        setCategories([]);
        setProducts([]);
        return;
      }
      const [cats, prods] = await Promise.all([
        fetchJson(`/api/admin/sites/${siteId}/categories`),
        fetchJson(`/api/admin/sites/${siteId}/products`),
      ]);
      setCategories(cats);
      setProducts(prods);
      const current = sitesList.find(s => s._id === siteId);
      if (current) {
        try { localStorage.setItem('admin_selected_site_slug', current.slug); } catch {}
      }
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [selectedSiteId]);

  useEffect(() => {
    async function loadOrders() {
      if (!selectedSiteId || activeTab !== 'orders') return;
      try {
        setOrdersLoading(true);
        setOrdersError(undefined);
        const params = new URLSearchParams();
        if (ordersFrom) params.set('from', ordersFrom);
        if (ordersTo) params.set('to', ordersTo);
        const data = await fetchJson(`/api/admin/sites/${selectedSiteId}/orders${params.toString() ? ('?' + params.toString()) : ''}`);
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        setOrdersError(e.message || 'Failed to load orders');
      } finally {
        setOrdersLoading(false);
      }
    }
    loadOrders();
  }, [activeTab, selectedSiteId, ordersFrom, ordersTo]);

  useEffect(() => {
    async function loadBilling() {
      if (!selectedSiteId) return setBilling(null);
      try {
        const data = await fetchJson(`/api/admin/sites/${selectedSiteId}/billing`);
        setBilling(data);
        setTodayBilling({ todayTotalCents: data.todayTotalCents || 0, todayDeliveryFeeCents: data.todayDeliveryFeeCents || 0 });
      } catch {
        setBilling(null);
      }
    }
    loadBilling();
  }, [selectedSiteId, activeTab]);

  useEffect(() => {
    if (selectedSiteId) {
      try { localStorage.setItem('admin_selected_site', selectedSiteId); } catch {}
    }
  }, [selectedSiteId]);

  const [vegFilter, setVegFilter] = useState('all');

  const filteredProducts = useMemo(() => {
    let list = filterCategory ? products.filter((p) => p.categoryId === filterCategory) : products;
    if (vegFilter === 'veg') list = list.filter((p) => p.isVeg !== false);
    if (vegFilter === 'nonveg') list = list.filter((p) => p.isVeg === false);
    return list;
  }, [products, filterCategory, vegFilter]);

  function startCreate() {
    setEditing({ name: '', price: 0, categoryId: categories[0]?._id || '', description: '', imageUrl: '', spiceLevels: [], extraOptionGroups: [] });
  }

  function startEdit(p) {
    setEditing({ ...p });
  }

  async function saveEditing() {
    if (!editing) return;
    const payload = {
      name: editing.name,
      description: editing.description,
      imageUrl: editing.imageUrl,
      price: Number(editing.price || 0),
      categoryId: editing.categoryId,
      spiceLevels: editing.spiceLevels || [],
      extraOptionGroups: editing.extraOptionGroups || [],
    };
    if (editing._id) {
      const updated = await putJson(`/api/admin/sites/${selectedSiteId}/products/${editing._id}`, payload);
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    } else {
      const created = await postJson(`/api/admin/sites/${selectedSiteId}/products`, payload);
      setProducts((prev) => [created, ...prev]);
    }
    setEditing(null);
  }

  async function deleteProduct(id) {
    setDeleteProductId(id);
  }

  if (loading) return <div>Loading admin...</div>;
  if (error) return <div style={{ color: 'red' }}>Failed to load admin: {error}</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
      <aside className="card" style={{ padding: 12, borderRadius: 'var(--radius)' }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Filters</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Site</span>
          <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.slug})</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => {
            setSiteForm({ name: '', slug: '', domainsText: '' });
            setIsSiteFormOpen(true);
          }}>+ New site</button>
          <button onClick={() => {
            if (!selectedSiteId) return;
            const current = sites.find(s => s._id === selectedSiteId);
            if (!current) return;
            setSiteForm({ id: current._id, name: current.name, slug: current.slug, domainsText: (current.domains || []).join(', ') });
            setIsSiteFormOpen(true);
          }}>Edit site</button>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Category</span>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Veg / Non-Veg</span>
          <select value={vegFilter} onChange={(e) => setVegFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="veg">🟢 Veg</option>
            <option value="nonveg">🔴 Non-Veg</option>
          </select>
        </label>
        <button onClick={() => {
          setCategoryForm({ name: '', imageUrl: '' });
          setIsCategoryFormOpen(true);
          setActiveTab('categories');
        }}>+ New category</button>
        <button className="primary-btn" style={{ marginTop: 12 }} onClick={startCreate}>+ New product</button>
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={activeTab === 'links' ? 'primary-btn' : ''} onClick={() => setActiveTab('links')}>Links</button>
          <button className={activeTab === 'settings' ? 'primary-btn' : ''} onClick={() => setActiveTab('settings')}>Settings</button>
          <button className={activeTab === 'categories' ? 'primary-btn' : ''} onClick={() => setActiveTab('categories')}>Categories</button>
          <button className={activeTab === 'products' ? 'primary-btn' : ''} onClick={() => setActiveTab('products')}>Products</button>
          <button className={activeTab === 'orders' ? 'primary-btn' : ''} onClick={() => setActiveTab('orders')}>Orders</button>
          <button className={activeTab === 'billing' ? 'primary-btn' : ''} onClick={() => setActiveTab('billing')}>Billing</button>
        </div>
        {activeTab === 'billing' ? (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Billing (Weekly / Monthly)</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="card" style={{ padding: 12, minWidth: 220, borderTop: '3px solid var(--primary)' }}>
                <div className="muted" style={{ fontSize: 12 }}>Today total</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--primary-600)' }}>${(((todayBilling?.todayTotalCents)||0)/100).toFixed(2)}</div>
                <div className="muted" style={{ fontSize: 12 }}>Delivery fees: ${(((todayBilling?.todayDeliveryFeeCents)||0)/100).toFixed(2)}</div>
              </div>
              <div className="card" style={{ padding: 12, minWidth: 220, borderTop: '3px solid var(--primary)' }}>
                <div className="muted" style={{ fontSize: 12 }}>This week</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--primary-600)' }}>${((billing?.weekTotalCents || 0)/100).toFixed(2)}</div>
              </div>
              <div className="card" style={{ padding: 12, minWidth: 220, borderTop: '3px solid var(--primary)' }}>
                <div className="muted" style={{ fontSize: 12 }}>This month</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--primary-600)' }}>${((billing?.monthTotalCents || 0)/100).toFixed(2)}</div>
              </div>
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Totals include item prices plus tip.</div>
          </div>
        ) : null}

        {activeTab === 'links' ? (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>All Pages (Links)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {sites.map((s) => (
                <div key={s._id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800 }}>{s.name}</div>
                  <div className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>/{s.slug}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <a href={`/s/${s.slug}`} target="_blank" rel="noreferrer">Open</a>
                    {(s.domains || []).map((d, i) => (
                      <a key={i} href={`https://${d}`} target="_blank" rel="noreferrer">{d}</a>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => { setSelectedSiteId(s._id); setActiveTab('settings'); }}>Manage</button>
                    <button onClick={() => { setSelectedSiteId(s._id); setActiveTab('products'); }}>Products</button>
                    <button onClick={() => { setSiteForm({ id: s._id, name: s.name, slug: s.slug, domainsText: (s.domains || []).join(', ') }); setIsSiteFormOpen(true); }}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'categories' ? (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>Categories</div>
              <button onClick={() => { setCategoryForm({ name: '', imageUrl: '' }); setIsCategoryFormOpen(true); }}>+ New category</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 10 }}>
              {categories.map((c) => (
                <div key={c._id} className="card" style={{ padding: 12 }}>
                  <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(59,130,246,0.08), rgba(236,72,153,0.08))', marginBottom: 10 }}>
                    {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="img-cover" /> : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>ID: {c._id.slice(-6)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => { setCategoryForm({ id: c._id, name: c.name, imageUrl: c.imageUrl || '' }); setIsCategoryFormOpen(true); }}>Edit</button>
                    <button className="danger" onClick={() => setDeleteCategoryId(c._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Site Settings</div>
            <SiteSettingsPanel
              site={sites.find(s => s._id === selectedSiteId)}
              selectedSiteId={selectedSiteId}
              onSiteUpdated={(updated) => setSites(prev => prev.map(s => s._id === updated._id ? updated : s))}
            />
          </div>
        ) : null}

        {activeTab === 'orders' ? (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800 }}>Orders</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="muted" style={{ fontSize: 12 }}>From</span>
                  <input type="date" value={ordersFrom} onChange={(e) => setOrdersFrom(e.target.value)} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="muted" style={{ fontSize: 12 }}>To</span>
                  <input type="date" value={ordersTo} onChange={(e) => setOrdersTo(e.target.value)} />
                </label>
                <button onClick={() => { setOrdersFrom(''); setOrdersTo(''); }}>Clear</button>
              </div>
            </div>
            {ordersLoading ? <div style={{ marginTop: 10 }}>Loading orders…</div> : null}
            {ordersError ? <div style={{ color: 'red', marginTop: 10 }}>{ordersError}</div> : null}
            {!ordersLoading && !ordersError ? (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Order #</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Customer</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Price</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(orders) ? orders : []).map((o) => {
                      const customer = o.dropoff?.name || o.userEmail || '—';
                      const itemsText = (Array.isArray(o.items) ? o.items : []).map((it) => `${it.name} × ${it.quantity}`).join(', ');
                      return (
                        <tr key={o._id}>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>#{String(o._id || '').slice(-6)}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>{customer}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>{new Date(o.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--primary-600)' }}>${((o.totalCents||0)/100).toFixed(2)}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>{itemsText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!orders || orders.length === 0) ? (
                  <div className="muted" style={{ marginTop: 8 }}>No orders for selected filters.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'products' ? (
          <>
            {editing ? (
              <div className="card animate-popIn" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800 }}>{editing._id ? 'Edit product' : 'Create product'}</div>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Name</span>
                    <input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Price</span>
                    <input type="number" step="0.01" value={editing.price || 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={editing.isVeg !== false}
                      onChange={(e) => setEditing({ ...editing, isVeg: e.target.checked })}
                    />
                    <span>Veg (unchecked = Non-Veg)</span>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Category</span>
                    <select value={editing.categoryId || ''} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}>
                      {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Image URL</span>
                    <input value={editing.imageUrl || ''} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} />
                  </label>
                  <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Description</span>
                    <textarea rows={3} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Spice levels</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['Mild','Medium','Hot','Extra Hot'].map((lvl) => (
                        <label key={lvl} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 8 }}>
                          <input type="checkbox" checked={(editing.spiceLevels || []).includes(lvl)} onChange={(e) => {
                            const set = new Set(editing.spiceLevels || []);
                            if (e.target.checked) set.add(lvl); else set.delete(lvl);
                            setEditing({ ...editing, spiceLevels: Array.from(set) });
                          }} />
                          <span>{lvl}</span>
                        </label>
                      ))}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="muted" style={{ fontSize: 12 }}>Custom:</span>
                      <input placeholder="e.g. No Spice" onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const value = input.value.trim();
                          if (value) {
                            const set = new Set(editing.spiceLevels || []);
                            set.add(value);
                            setEditing({ ...editing, spiceLevels: Array.from(set) });
                            input.value = '';
                          }
                          e.preventDefault();
                        }
                      }} />
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Extra option groups (JSON)</span>
                    <textarea
                      rows={4}
                      value={JSON.stringify(editing.extraOptionGroups || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setEditing({ ...editing, extraOptionGroups: parsed });
                        } catch {}
                      }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                  <button className="primary-btn" onClick={saveEditing}>{editing._id ? 'Save changes' : 'Create'}</button>
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, margin: '6px 0 8px' }}>
              <button title="Download Excel with Categories and Products sheets" onClick={async () => {
                if (!selectedSiteId) return;
                const blob = await download(`/api/admin/sites/${selectedSiteId}/products/template.xlsx`);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'product_template.xlsx'; a.click();
                URL.revokeObjectURL(url);
              }}>Download template (Categories + Products)</button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !selectedSiteId) return;
                const res = await postFile(`/api/admin/sites/${selectedSiteId}/products/bulk`, file);
                await loadAll();
                const productsCount = res.createdProducts ?? res.created ?? 0;
                const categoriesCount = res.createdCategories ?? 0;
                alert(`Imported ${productsCount} products and ${categoriesCount} categories`);
                e.currentTarget.value = '';
              }} />
              <button title="Upload Excel to auto-create categories with images and their products" onClick={() => fileInputRef.current?.click()}>Upload Excel (auto create)</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {filteredProducts.map((p) => (
                <div key={p._id} className="card" style={{ padding: 12 }}>
                  <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))', marginBottom: 10 }}>
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="img-cover" /> : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                    <div title={p.isVeg === false ? 'Non-Veg' : 'Veg'}>{p.isVeg === false ? '🔴' : '🟢'}</div>
                  </div>
                  <div className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>{p.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, color: 'var(--primary-600)' }}>${p.price.toFixed(2)}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startEdit(p)}>Edit</button>
                      <button className="danger" onClick={() => deleteProduct(p._id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <Modal
          open={isSiteFormOpen}
          onClose={() => setIsSiteFormOpen(false)}
          title={siteForm.id ? 'Edit site' : 'Create site'}
          footer={(
            <>
              <button onClick={() => setIsSiteFormOpen(false)}>Cancel</button>
              <button
                className="primary-btn"
                onClick={async () => {
                  const domains = siteForm.domainsText.split(',').map(d => d.trim()).filter(Boolean);
                  if (!siteForm.name || !siteForm.slug) return;
                  if (siteForm.id) {
                    const updated = await patchJson(`/api/admin/sites/${siteForm.id}`, { name: siteForm.name, slug: siteForm.slug, domains });
                    setSites(prev => prev.map(s => s._id === updated._id ? updated : s));
                    setSelectedSiteId(updated._id);
                  } else {
                    const created = await postJson('/api/admin/sites', { name: siteForm.name, slug: siteForm.slug, domains });
                    setSites(prev => [created, ...prev]);
                    setSelectedSiteId(created._id);
                  }
                  setIsSiteFormOpen(false);
                  setActiveTab('links');
                }}
              >{siteForm.id ? 'Save changes' : 'Create site'}</button>
            </>
          )}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Name</span>
              <input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Slug</span>
              <input value={siteForm.slug} onChange={(e) => setSiteForm({ ...siteForm, slug: e.target.value })} placeholder="my-site" />
            </label>
            <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Domains (comma separated)</span>
              <input value={siteForm.domainsText} onChange={(e) => setSiteForm({ ...siteForm, domainsText: e.target.value })} placeholder="example.com, shop.example.com" />
            </label>
          </div>
        </Modal>

        <Modal
          open={isCategoryFormOpen}
          onClose={() => setIsCategoryFormOpen(false)}
          title={categoryForm.id ? 'Edit category' : 'Create category'}
          footer={(
            <>
              <button onClick={() => setIsCategoryFormOpen(false)}>Cancel</button>
              <button
                className="primary-btn"
                onClick={async () => {
                  if (!categoryForm.name) return;
                  if (categoryForm.id) {
                    const updated = await patchJson(`/api/admin/sites/${selectedSiteId}/categories/${categoryForm.id}`, { name: categoryForm.name, imageUrl: categoryForm.imageUrl });
                    setCategories((prev) => prev.map((c) => c._id === updated._id ? updated : c));
                    setIsCategoryFormOpen(false);
                    setCategoryForm({ name: '', imageUrl: '' });
                  } else {
                    const created = await postJson(`/api/admin/sites/${selectedSiteId}/categories`, { name: categoryForm.name, imageUrl: categoryForm.imageUrl });
                    setCategories((prev) => [created, ...prev]);
                    setIsCategoryFormOpen(false);
                  }
                }}
              >{categoryForm.id ? 'Save changes' : 'Create'}</button>
            </>
          )}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Name</span>
              <input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Image URL</span>
              <input value={categoryForm.imageUrl} onChange={(e) => setCategoryForm({ ...categoryForm, imageUrl: e.target.value })} />
            </label>
          </div>
        </Modal>

        <Modal
          open={!!deleteProductId}
          onClose={() => setDeleteProductId(null)}
          title="Delete product"
          footer={(
            <>
              <button onClick={() => setDeleteProductId(null)}>Cancel</button>
              <button className="danger" onClick={async () => {
                if (!deleteProductId) return;
                await deleteJson(`/api/admin/sites/${selectedSiteId}/products/${deleteProductId}`);
                setProducts((prev) => prev.filter((p) => p._id !== deleteProductId));
                setDeleteProductId(null);
              }}>Delete</button>
            </>
          )}
        >
          <div>Are you sure you want to delete this product? This action cannot be undone.</div>
        </Modal>

        <Modal
          open={!!deleteCategoryId}
          onClose={() => setDeleteCategoryId(null)}
          title="Delete category"
          footer={(
            <>
              <button onClick={() => setDeleteCategoryId(null)}>Cancel</button>
              <button className="danger" onClick={async () => {
                if (!deleteCategoryId) return;
                await deleteJson(`/api/admin/sites/${selectedSiteId}/categories/${deleteCategoryId}`);
                setCategories((prev) => prev.filter((c) => c._id !== deleteCategoryId));
                setDeleteCategoryId(null);
              }}>Delete</button>
            </>
          )}
        >
          <div>Are you sure you want to delete this category? Products will remain but be unfiltered.</div>
        </Modal>

      </section>
    </div>
  );
}

