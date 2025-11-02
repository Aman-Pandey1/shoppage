import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import './ExtrasModal.css';

function normalizeGroups(groups) {
  return Array.isArray(groups) ? groups : [];
}

function resolveGroupKey(group, idx = 0) {
  if (group?.groupKey) return group.groupKey;
  if (group?.groupLabel) return group.groupLabel;
  return `group_${idx}`;
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
  normalizeGroups(groups).forEach((group, idx) => {
    const groupKey = resolveGroupKey(group, idx);
    const options = Array.isArray(group?.options) ? group.options : [];
    const selectionType = group?.selectionType === 'single' ? 'single' : 'multi';
    const selected = new Set();

    if (selectionType === 'single') {
      const defaultOption = options.find((opt) => opt?.isDefault);
      if (defaultOption) {
        selected.add(defaultOption.key);
      } else if ((group?.isRequired || Number(group?.minSelect) >= 1) && options.length === 1) {
        selected.add(options[0].key);
      }
    } else if (options.length) {
      options.forEach((opt) => {
        if (opt?.isDefault) selected.add(opt.key);
      });
    }

    state[groupKey] = selected;
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
  const productDescription = useMemo(() => (
    product?.description
    || product?.summary
    || product?.shortDescription
    || product?.subtitle
    || ''
  ), [product]);

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
    return groups.map((group, idx) => {
      const groupKey = resolveGroupKey(group, idx);
      const selectionType = group?.selectionType === 'single' ? 'single' : 'multi';
      const options = Array.isArray(group?.options) ? group.options : [];
      const { min, max } = clampSelections(selectionType, group?.minSelect, group?.maxSelect, options.length);
      const selectedSet = selectedByGroup[groupKey] instanceof Set
        ? selectedByGroup[groupKey]
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
        if (current.has(optionKey)) {
          if (min <= 0) {
            return { ...prev, [groupKey]: new Set() };
          }
          return prev;
        }
        return { ...prev, [groupKey]: new Set(optionKey ? [optionKey] : []) };
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
        <div className="extras-modal__footer">
          <div className="extras-modal__total">Total: {currency(totalPrice)}</div>
          <div className="extras-modal__footer-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="button" className="primary-btn" disabled={!canConfirm} onClick={handleConfirm}>
              Add to order {currency(unitPrice)}
            </button>
          </div>
        </div>
      )}
    >
      <div className="extras-modal">
        <div className="extras-modal__summary">
          <div className="extras-modal__summary-text">
            <span className="extras-modal__eyebrow">You're customizing</span>
            <h3 className="extras-modal__name">{product?.name || 'Menu item'}</h3>
            {(productDescription || groups.length || variants.length || flavors.length || portions.length || quantities.length) ? (
              productDescription
                ? <p className="extras-modal__description">{productDescription}</p>
                : <p className="extras-modal__description">Choose your favorite add-ons and build the perfect bite.</p>
            ) : null}
          </div>
          <div className="extras-modal__price-chip">
            <span>Starting at</span>
            <strong>{currency(basePrice)}</strong>
          </div>
        </div>

        <div className="extras-sections">
          {variants.length ? (
            <section className="extras-group">
              <header className="extras-group__header">
                <div>
                  <h4 className="extras-group__title">Choose size</h4>
                  <p className="extras-group__hint muted">Pick the size that suits your appetite.</p>
                </div>
                <span className="extras-badge extras-badge--required">Required</span>
              </header>
              <div className="extras-options">
                {variants.map((variant) => {
                  const price = Number(variant?.price || 0);
                  const active = selectedVariantKey === variant.key;
                  return (
                    <label
                      key={variant.key}
                      className={`extras-option ${active ? 'extras-option--active' : ''}`}
                    >
                      <div className="extras-option__control">
                        <input
                          type="radio"
                          name="variant"
                          checked={active}
                          onChange={() => setSelectedVariantKey(variant.key)}
                        />
                        <span>{variant.label}</span>
                      </div>
                      <div className="extras-option__price" data-included={price === 0 ? 'true' : 'false'}>
                        {price ? `+${currency(price)}` : 'Included'}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          {groupSelections.map(({ group, selectionType, options, min, max, selectedSet }, idx) => {
            if (!options.length) return null;
            const groupKey = resolveGroupKey(group, idx);
            const isRequired = selectionType === 'single' || min > 0;
            const badgeText = selectionType === 'single'
              ? 'Required'
              : (min > 0 ? `Choose at least ${min}` : 'Optional');
            const maxText = max && max !== Infinity && selectionType === 'multi' ? ` (up to ${max})` : '';
            return (
              <section key={groupKey} className="extras-group">
                <header className="extras-group__header">
                  <div>
                    <h4 className="extras-group__title">{group?.groupLabel || 'Options'}</h4>
                    {group?.helpText ? (
                      <p className="extras-group__hint muted">{group.helpText}</p>
                    ) : null}
                  </div>
                  <span className={`extras-badge ${isRequired ? 'extras-badge--required' : 'extras-badge--optional'}`}>
                    {badgeText}{maxText}
                  </span>
                </header>
                <div className="extras-options">
                  {options.map((opt) => {
                    const active = selectedSet.has(opt.key);
                    const price = Number(opt?.priceDelta || 0);
                    return (
                      <label
                        key={opt.key}
                        className={`extras-option ${active ? 'extras-option--active' : ''}`}
                      >
                        <div className="extras-option__control">
                          <input
                            type={selectionType === 'single' ? 'radio' : 'checkbox'}
                            name={selectionType === 'single' ? `group-${groupKey}` : undefined}
                            checked={active}
                            onChange={() => handleToggleOption(groupKey, selectionType, min, max, opt.key)}
                          />
                          <span>{opt.label}</span>
                        </div>
                        <div className="extras-option__price" data-included={price === 0 ? 'true' : 'false'}>
                          {price ? `+${currency(price)}` : 'Included'}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {flavors.length ? (
            <section className="extras-group">
              <header className="extras-group__header">
                <div>
                  <h4 className="extras-group__title">Flavor</h4>
                  <p className="extras-group__hint muted">Add a flavor accent to elevate the dish.</p>
                </div>
                <span className={`extras-badge ${flavorRequired ? 'extras-badge--required' : 'extras-badge--optional'}`}>
                  {flavorRequired ? 'Required' : 'Optional'}
                </span>
              </header>
              <div className="extras-options">
                {flavors.map((flavor) => {
                  const price = Number(flavor?.price || 0);
                  const active = selectedFlavorKey === flavor.key;
                  return (
                    <label
                      key={flavor.key}
                      className={`extras-option ${active ? 'extras-option--active' : ''}`}
                    >
                      <div className="extras-option__control">
                        <input
                          type="radio"
                          name="flavor"
                          checked={active}
                          onChange={() => setSelectedFlavorKey(flavor.key)}
                        />
                        <span>{flavor.label}</span>
                      </div>
                      <div className="extras-option__price" data-included={price === 0 ? 'true' : 'false'}>
                        {price ? `+${currency(price)}` : 'Included'}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          {portions.length ? (
            <section className="extras-group">
              <header className="extras-group__header">
                <div>
                  <h4 className="extras-group__title">Portion</h4>
                  <p className="extras-group__hint muted">Select the serving style you prefer.</p>
                </div>
                <span className={`extras-badge ${portionRequired ? 'extras-badge--required' : 'extras-badge--optional'}`}>
                  {portionRequired ? 'Required' : 'Optional'}
                </span>
              </header>
              <div className="extras-options">
                {portions.map((portion) => {
                  const price = Number(portion?.price || 0);
                  const active = selectedPortionKey === portion.key;
                  return (
                    <label
                      key={portion.key}
                      className={`extras-option ${active ? 'extras-option--active' : ''}`}
                    >
                      <div className="extras-option__control">
                        <input
                          type="radio"
                          name="portion"
                          checked={active}
                          onChange={() => setSelectedPortionKey(portion.key)}
                        />
                        <span>{portion.label}</span>
                      </div>
                      <div className="extras-option__price" data-included={price === 0 ? 'true' : 'false'}>
                        {price ? `+${currency(price)}` : 'Included'}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          {quantities.length ? (
            <section className="extras-group">
              <header className="extras-group__header">
                <div>
                  <h4 className="extras-group__title">Quantity choice</h4>
                  <p className="extras-group__hint muted">Choose a preset combo if available.</p>
                </div>
                <span className={`extras-badge ${quantityRequired ? 'extras-badge--required' : 'extras-badge--optional'}`}>
                  {quantityRequired ? 'Required' : 'Optional'}
                </span>
              </header>
              <div className="extras-options">
                {quantities.map((quantityOption) => {
                  const price = Number(quantityOption?.price || 0);
                  const active = selectedQuantityKey === quantityOption.key;
                  return (
                    <label
                      key={quantityOption.key}
                      className={`extras-option ${active ? 'extras-option--active' : ''}`}
                    >
                      <div className="extras-option__control">
                        <input
                          type="radio"
                          name="quantityOption"
                          checked={active}
                          onChange={() => setSelectedQuantityKey(quantityOption.key)}
                        />
                        <span>{quantityOption.label}</span>
                      </div>
                      <div className="extras-option__price" data-included={price === 0 ? 'true' : 'false'}>
                        {price ? `+${currency(price)}` : 'Included'}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="extras-quantity">
            <div className="extras-quantity__label">
              <h4>Quantity</h4>
              <p className="muted">Set how many of this item you'd like to add.</p>
            </div>
            <div className="extras-quantity__controls">
              <button
                type="button"
                className="extras-quantity__btn"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
              >
                -
              </button>
              <span className="extras-quantity__value">{quantity}</span>
              <button
                type="button"
                className="extras-quantity__btn"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
};

