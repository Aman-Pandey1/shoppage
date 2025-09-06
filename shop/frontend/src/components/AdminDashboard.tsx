import React, { useEffect, useMemo, useState } from 'react';
import { deleteJson, fetchJson, postJson, putJson, patchJson } from '../lib/api';
import type { Category, Product, Site } from '../types';
import { SiteSettingsPanel } from './SiteSettingsPanel';

type EditableProduct = Partial<Product> & { _id?: string };

export const AdminDashboard: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [editing, setEditing] = useState<EditableProduct | null>(null);

  async function loadAll() {
    try {
      setLoading(true);
      // Load sites first
      const sitesList = await fetchJson<Site[]>('/api/admin/sites');
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
        fetchJson<Category[]>(`/api/admin/sites/${siteId}/categories`),
        fetchJson<Product[]>(`/api/admin/sites/${siteId}/products`),
      ]);
      setCategories(cats);
      setProducts(prods);
      const current = sitesList.find(s => s._id === siteId);
      if (current) {
        try { localStorage.setItem('admin_selected_site_slug', current.slug); } catch {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [selectedSiteId]);

  useEffect(() => {
    if (selectedSiteId) {
      try { localStorage.setItem('admin_selected_site', selectedSiteId); } catch {}
    }
  }, [selectedSiteId]);

  const filteredProducts = useMemo(() => {
    return filterCategory ? products.filter((p) => p.categoryId === filterCategory) : products;
  }, [products, filterCategory]);

  function startCreate() {
    setEditing({ name: '', price: 0, categoryId: categories[0]?._id || '', description: '', imageUrl: '', spiceLevels: [], extraOptionGroups: [] });
  }

  function startEdit(p: Product) {
    setEditing({ ...p });
  }

  async function saveEditing() {
    if (!editing) return;
    const payload: any = {
      name: editing.name,
      description: editing.description,
      imageUrl: editing.imageUrl,
      price: Number(editing.price || 0),
      categoryId: editing.categoryId,
      spiceLevels: editing.spiceLevels || [],
      extraOptionGroups: editing.extraOptionGroups || [],
    };
    if (editing._id) {
      const updated = await putJson<Product>(`/api/admin/sites/${selectedSiteId}/products/${editing._id}`, payload);
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    } else {
      const created = await postJson<Product>(`/api/admin/sites/${selectedSiteId}/products`, payload);
      setProducts((prev) => [created, ...prev]);
    }
    setEditing(null);
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product?')) return;
    await deleteJson(`/api/admin/sites/${selectedSiteId}/products/${id}`);
    setProducts((prev) => prev.filter((p) => p._id !== id));
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
          <button onClick={async () => {
            const name = prompt('Site name?');
            const slug = prompt('Site slug?');
            if (!name || !slug) return;
            const created = await postJson<Site>('/api/admin/sites', { name, slug });
            setSites((prev) => [created, ...prev]);
            setSelectedSiteId(created._id);
          }}>+ New site</button>
          <button onClick={async () => {
            if (!selectedSiteId) return;
            const newName = prompt('Rename site to?');
            if (!newName) return;
            const updated = await patchJson<Site>(`/api/admin/sites/${selectedSiteId}`, { name: newName });
            setSites((prev) => prev.map((s) => s._id === updated._id ? updated : s));
          }}>Rename</button>
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
        <button onClick={async () => {
          const name = prompt('New category name?');
          const imageUrl = prompt('Category image URL?') || '';
          if (!name) return;
          const created = await postJson<Category>(`/api/admin/sites/${selectedSiteId}/categories`, { name, imageUrl });
          setCategories((prev) => [created, ...prev]);
        }}>+ New category</button>
        <button className="primary-btn" style={{ marginTop: 12 }} onClick={startCreate}>+ New product</button>
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Site settings */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Site Settings</div>
          <SiteSettingsPanel
            site={sites.find(s => s._id === selectedSiteId)}
            selectedSiteId={selectedSiteId}
            onSiteUpdated={(updated) => setSites(prev => prev.map(s => s._id === updated._id ? updated : s))}
          />
        </div>
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
                <input type="number" step="0.01" value={editing.price as number} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
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
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Spice levels (comma separated)</span>
                <input
                  value={(editing.spiceLevels || []).join(', ')}
                  onChange={(e) => setEditing({ ...editing, spiceLevels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </label>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filteredProducts.map((p) => (
            <div key={p._id} className="card" style={{ padding: 12 }}>
              <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))', marginBottom: 10 }}>
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="img-cover" /> : null}
              </div>
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>{p.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>${p.price.toFixed(2)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(p)}>Edit</button>
                  <button className="danger" onClick={() => deleteProduct(p._id!)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

