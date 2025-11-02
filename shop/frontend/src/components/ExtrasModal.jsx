import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { resolveAssetUrl } from '../lib/api';

function normalizeGroups(groups) {
  return Array.isArray(groups) ? groups : [];
}

function clampSelections(selectionType, minSelect = 0, maxSelect = 0, optionsLength = 0) {
  if (selectionType === 'single') {
    return { min: 1, max: 1 };
  }
  const min = Math.max(0, Number(minSelect) || 0);
  const max = Math.max(0, Number(maxSelect) || optionsLength || 0);
  if (max === 0) return { min, max: optionsLength || min || Infinity };
  return { min: Math.min(min, max), max: Math.max(min || 0, max) };
}

function buildInitialGroupSelections(groups) {
  const state = {};
  normalizeGroups(groups).forEach((group) => {
    const options = Array.isArray(group?.options) ? group.options : [];
    const selectionType = group?.selectionType === 'single' ? 'single' : 'multi';
    if (!options.length) {
      state[group.groupKey] = new Set();
      return;
    }
    if (selectionType === 'single') {
      const defaultOption = options.find((opt) => opt?.isDefault) || options[0];
      state[group.groupKey] = new Set(defaultOption ? [defaultOption.key] : []);
    } else {
      const defaults = options.filter((opt) => opt?.isDefault).map((opt) => opt.key);
      state[group.groupKey] = new Set(defaults);
    }
  });
  return state;
}

const currency = (value) => `$${Number(value || 0).toFixed(2)}`;

export const ExtrasModal = ({
  open,
  product,
  onCancel,
  onConfirm,
  initialQuantity = 1,
}) => {
  const variants = useMemo(() => (Array.isArray(product?.variants) ? product.variants : []), [product]);
  const flavors = useMemo(() => (Array.isArray(product?.flavors) ? product.flavors : []), [product]);
  const portions = useMemo(() => (Array.isArray(product?.portions) ? product.portions : []), [product]);
  const quantities = useMemo(() => (Array.isArray(product?.quantities) ? product.quantities : []), [product]);
  const groups = useMemo(() => normalizeGroups(product?.extraOptionGroups), [product]);

  const [selectedVariantKey, setSelectedVariantKey] = useState('');
  const [selectedFlavorKey, setSelectedFlavorKey] = useState('');
  const [selectedPortionKey, setSelectedPortionKey] = useState('');
  const [selectedQuantityKey, setSelectedQuantityKey] = useState('');
  const [quantity, setQuantity] = useState(() => Math.max(1, Math.min(99, Number(initialQuantity) || 1)));
  const [selectedByGroup, setSelectedByGroup] = useState({});

  const productId = product?._id || product?.id || '';

  useEffect(() => {
    if (!open) return;
    setSelectedVariantKey(() => (variants.length ? variants[0].key : ''));
    setSelectedFlavorKey(() => (flavors.length ? '' : ''));
    setSelectedPortionKey(() => (portions.length ? '' : ''));
    setSelectedQuantityKey(() => (quantities.length ? '' : ''));
    setQuantity(Math.max(1, Math.min(99, Number(initialQuantity) || 1)));
    setSelectedByGroup(buildInitialGroupSelections(groups));
  }, [open, productId, variants, flavors, portions, quantities, groups, initialQuantity]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.key === selectedVariantKey) || null,
    [variants, selectedVariantKey]
  );

  const selectedFlavor = useMemo(
    () => flavors.find((f) => f.key === selectedFlavorKey) || null,
    [flavors, selectedFlavorKey]
  );

  const selectedPortion = useMemo(
    () => portions.find((p) => p.key === selectedPortionKey) || null,
    [portions, selectedPortionKey]
  );

  const selectedQuantityOption = useMemo(
    () => quantities.find((q) => q.key === selectedQuantityKey) || null,
    [quantities, selectedQuantityKey]
  );

  const groupSelections = useMemo(() => {
    return groups.map((group) => {
      const selectionType = group?.selectionType === 'single' ? 'single' : 'multi';
      const options = Array.isArray(group?.options) ? group.options : [];
      const { min, max } = clampSelections(selectionType, group?.minSelect, group?.maxSelect, options.length);
      const selectedSet = selectedByGroup[group.groupKey] instanceof Set
        ? selectedByGroup[group.groupKey]
        : new Set();
      return { group, selectionType, options, min, max, selectedSet };
    });
  }, [groups, selectedByGroup]);

  const isVariantRequired = variants.length > 0;
  const flavorRequired = flavors.length > 0 && flavors.some((f) => f?.price !== undefined || f?.label);
  const portionRequired = portions.length > 0 && portions.some((p) => p?.price !== undefined || p?.label);
  const quantityRequired = quantities.length > 0 && quantities.some((q) => q?.price !== undefined || q?.label);

  const extraCost = useMemo(() => {
    let cost = 0;
    groupSelections.forEach(({ options, selectedSet }) => {
      options.forEach((opt) => {
        if (selectedSet.has(opt.key)) cost += Number(opt?.priceDelta || 0);
      });
    });
    return cost;
  }, [groupSelections]);

  const basePrice = Number(product?.price || 0);
  const variantPrice = Number(selectedVariant?.price || 0);
  const flavorPrice = Number(selectedFlavor?.price || 0);
  const portionPrice = Number(selectedPortion?.price || 0);
  const quantityPrice = Number(selectedQuantityOption?.price || 0);
  const unitPrice = basePrice + variantPrice + flavorPrice + portionPrice + quantityPrice + extraCost;
  const totalPrice = unitPrice * quantity;

  const canConfirm = useMemo(() => {
    if (isVariantRequired && !selectedVariantKey) return false;
    if (flavorRequired && !selectedFlavorKey) return false;
    if (portionRequired && !selectedPortionKey) return false;
    if (quantityRequired && !selectedQuantityKey) return false;
    for (const { min, max, selectedSet } of groupSelections) {
      if (selectedSet.size < min) return false;
      if (max && max !== Infinity && selectedSet.size > max) return false;
    }
    return quantity >= 1;
  }, [isVariantRequired, selectedVariantKey, flavorRequired, selectedFlavorKey, portionRequired, selectedPortionKey, quantityRequired, selectedQuantityKey, groupSelections, quantity]);

  const handleToggleOption = (groupKey, selectionType, min, max, optionKey) => {
    setSelectedByGroup((prev) => {
      const current = prev[groupKey] instanceof Set ? new Set(prev[groupKey]) : new Set();
      if (selectionType === 'single') {
        const next = new Set(optionKey ? [optionKey] : []);
        return { ...prev, [groupKey]: next };
      }
      if (current.has(optionKey)) {
        current.delete(optionKey);
        if (min > 0 && current.size < min) {
          // enforce minimum by leaving selection unchanged
          return prev;
        }
      } else {
        const limit = max && max !== Infinity ? max : Infinity;
        if (current.size >= limit) {
          return prev;
        }
        current.add(optionKey);
      }
      return { ...prev, [groupKey]: current };
    });
  };

  function handleConfirm() {
    const selectedOptions = [];
    groupSelections.forEach(({ group, options, selectedSet }) => {
      options.forEach((opt) => {
        if (selectedSet.has(opt.key)) {
          selectedOptions.push({
            groupKey: group.groupKey,
            groupLabel: group.groupLabel,
            optionKey: opt.key,
            optionLabel: opt.label,
            priceDelta: Number(opt?.priceDelta || 0),
          });
        }
      });
    });

    onConfirm({
      quantity,
      variant: selectedVariant || undefined,
      flavor: selectedFlavor || undefined,
      portion: selectedPortion || undefined,
      quantityOption: selectedQuantityOption || undefined,
      selectedOptions,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={product?.name ? `Customize ${product.name}` : 'Customize item'}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontWeight: 700 }}>
            Total: {currency(totalPrice)}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onCancel}>Cancel</button>
            <button className="primary-btn" disabled={!canConfirm} onClick={handleConfirm}>
              Add to order {currency(unitPrice)}
            </button>
          </div>
        </div>
      )}
    >
      {product ? (
        <div style={{ position: 'relative', height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border)' }}>
          {product.imageUrl ? (
            <img src={resolveAssetUrl(product.imageUrl)} alt={product.name} className="img-cover" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42, background: 'linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.16))' }}>???</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,0.55))' }} />
          <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{product.name}</div>
            <div style={{ fontWeight: 700 }}>{currency(basePrice)}</div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 16 }}>
        {variants.length ? (
          <section style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Choose size</h4>
              <span style={{ fontSize: 12, color: 'var(--success-700)', border: '1px solid var(--success-500)', borderRadius: 999, padding: '2px 8px' }}>Required</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {variants.map((variant) => (
                <label key={variant.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: selectedVariantKey === variant.key ? 'var(--primary-alpha-08)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      name="variant"
                      checked={selectedVariantKey === variant.key}
                      onChange={() => setSelectedVariantKey(variant.key)}
                    />
                    <span>{variant.label}</span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{variant.price ? `+${currency(variant.price)}` : 'Included'}</div>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {groups.map((groupInfo) => {
          const options = Array.isArray(groupInfo?.options) ? groupInfo.options : [];
          if (!options.length) return null;
          const selectionType = groupInfo?.selectionType === 'single' ? 'single' : 'multi';
          const { min, max } = clampSelections(selectionType, groupInfo?.minSelect, groupInfo?.maxSelect, options.length);
          const selectedSet = selectedByGroup[groupInfo.groupKey] instanceof Set
            ? selectedByGroup[groupInfo.groupKey]
            : new Set();
          const badge = selectionType === 'single'
            ? 'Required'
            : (min > 0 ? `Choose at least ${min}` : 'Optional');
          return (
            <section key={groupInfo.groupKey} style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{groupInfo.groupLabel}</h4>
                  {groupInfo.helpText ? <div className="muted" style={{ fontSize: 12 }}>{groupInfo.helpText}</div> : null}
                </div>
                <span style={{ fontSize: 12, borderRadius: 999, padding: '2px 8px', border: '1px solid var(--border)', color: 'var(--muted)' }}>{badge}{max && max !== Infinity && selectionType === 'multi' ? ` (up to ${max})` : ''}</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {options.map((opt) => {
                  const active = selectedSet.has(opt.key);
                  const price = Number(opt?.priceDelta || 0);
                  if (selectionType === 'single') {
                    return (
                      <label key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: active ? 'var(--primary-alpha-08)' : 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="radio"
                            name={`group-${groupInfo.groupKey}`}
                            checked={active}
                            onChange={() => handleToggleOption(groupInfo.groupKey, selectionType, min, max, opt.key)}
                          />
                          <span>{opt.label}</span>
                        </div>
                        <div style={{ fontWeight: 600 }}>{price ? `+${currency(price)}` : 'Included'}</div>
                      </label>
                    );
                  }
                  return (
                    <label key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: active ? 'var(--primary-alpha-08)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => handleToggleOption(groupInfo.groupKey, selectionType, min, max, opt.key)}
                        />
                        <span>{opt.label}</span>
                      </div>
                      <div style={{ fontWeight: 600 }}>{price ? `+${currency(price)}` : 'Included'}</div>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        {flavors.length ? (
          <section style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Flavor</h4>
              <span style={{ fontSize: 12, borderRadius: 999, padding: '2px 8px', border: '1px solid var(--border)', color: 'var(--muted)' }}>{flavorRequired ? 'Required' : 'Optional'}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {flavors.map((flavor) => (
                <label key={flavor.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: selectedFlavorKey === flavor.key ? 'var(--primary-alpha-08)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      name="flavor"
                      checked={selectedFlavorKey === flavor.key}
                      onChange={() => setSelectedFlavorKey(flavor.key)}
                    />
                    <span>{flavor.label}</span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{flavor.price ? `+${currency(flavor.price)}` : 'Included'}</div>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {portions.length ? (
          <section style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Portion</h4>
              <span style={{ fontSize: 12, borderRadius: 999, padding: '2px 8px', border: '1px solid var(--border)', color: 'var(--muted)' }}>{portionRequired ? 'Required' : 'Optional'}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {portions.map((portion) => (
                <label key={portion.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: selectedPortionKey === portion.key ? 'var(--primary-alpha-08)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      name="portion"
                      checked={selectedPortionKey === portion.key}
                      onChange={() => setSelectedPortionKey(portion.key)}
                    />
                    <span>{portion.label}</span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{portion.price ? `+${currency(portion.price)}` : 'Included'}</div>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {quantities.length ? (
          <section style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Quantity choice</h4>
              <span style={{ fontSize: 12, borderRadius: 999, padding: '2px 8px', border: '1px solid var(--border)', color: 'var(--muted)' }}>{quantityRequired ? 'Required' : 'Optional'}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {quantities.map((quantityOption) => (
                <label key={quantityOption.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: selectedQuantityKey === quantityOption.key ? 'var(--primary-alpha-08)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      name="quantityOption"
                      checked={selectedQuantityKey === quantityOption.key}
                      onChange={() => setSelectedQuantityKey(quantityOption.key)}
                    />
                    <span>{quantityOption.label}</span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{quantityOption.price ? `+${currency(quantityOption.price)}` : 'Included'}</div>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 12px', background: 'var(--panel-2)' }}>
          <div style={{ fontWeight: 700 }}>Quantity</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, border: '1px solid var(--border)', padding: 6, background: '#fff' }}>
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--panel)', cursor: 'pointer', fontSize: 18 }}
              aria-label="Decrease quantity"
            >?</button>
            <div style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{quantity}</div>
            <button
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--panel)', cursor: 'pointer', fontSize: 18 }}
              aria-label="Increase quantity"
            >+</button>
          </div>
        </section>

      </div>
    </Modal>
  );
};

