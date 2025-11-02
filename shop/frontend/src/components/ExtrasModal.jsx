import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import './ExtrasModal.css';
import { normalizeGroups, resolveGroupKey, clampSelections, makeGroupPath, makeOptionPath, hasAnyOptionsDeep } from '../lib/optionsTree';

const currency = (value) => `$${Number(value || 0).toFixed(2)}`;

function initializeFreeGroups(groups, parentPath, extraMap, freeMap) {
  normalizeGroups(groups).forEach((group, idx) => {
    const groupKey = resolveGroupKey(group, idx);
    const groupPath = makeGroupPath(parentPath, groupKey, idx, 'free');
    const options = Array.isArray(group?.options) ? group.options : [];
    const defaultOption = options.find((opt) => opt?.isDefault) || options[0];
    freeMap[groupPath] = defaultOption ? defaultOption.key : '';
    if (defaultOption) {
      const optionPath = makeOptionPath(groupPath, defaultOption.key, 'free');
      initializeFreeGroups(defaultOption.childFreeOptionGroups, optionPath, extraMap, freeMap);
      initializeExtraGroups(defaultOption.childExtraOptionGroups, optionPath, extraMap, freeMap);
    }
  });
}

function initializeExtraGroups(groups, parentPath, extraMap, freeMap) {
  normalizeGroups(groups).forEach((group, idx) => {
    const groupKey = resolveGroupKey(group, idx);
    const groupPath = makeGroupPath(parentPath, groupKey, idx, 'extra');
    const options = Array.isArray(group?.options) ? group.options : [];
    const selectionType = group?.selectionType === 'multi' ? 'multi' : 'single';
    const { min } = clampSelections(selectionType, group?.minSelect, group?.maxSelect, options.length);
    const selectedKeys = new Set();
    if (selectionType === 'single') {
      const defaultOption = options.find((opt) => opt?.isDefault) || options[0];
      if (defaultOption) selectedKeys.add(defaultOption.key);
    } else {
      options.forEach((opt) => { if (opt?.isDefault) selectedKeys.add(opt.key); });
      if (selectedKeys.size < min) {
        options.slice(0, min).forEach((opt) => selectedKeys.add(opt.key));
      }
    }
    extraMap[groupPath] = selectedKeys;
    options.forEach((option) => {
      if (!selectedKeys.has(option.key)) return;
      const optionPath = makeOptionPath(groupPath, option.key, 'extra');
      initializeFreeGroups(option.childFreeOptionGroups, optionPath, extraMap, freeMap);
      initializeExtraGroups(option.childExtraOptionGroups, optionPath, extraMap, freeMap);
    });
  });
}

function clearSelectionsUnderPath(extraMap, freeMap, optionPath) {
  const prefix = `${optionPath}__`;
  Object.keys(extraMap).forEach((key) => {
    if (key.startsWith(prefix)) delete extraMap[key];
  });
  Object.keys(freeMap).forEach((key) => {
    if (key.startsWith(prefix)) delete freeMap[key];
  });
}

function buildInitialSelectionState(extraGroups, freeGroups) {
  const extra = {};
  const free = {};
  initializeFreeGroups(freeGroups, '', extra, free);
  initializeExtraGroups(extraGroups, '', extra, free);
  return { extra, free };
}

function traverseFreeGroups(groups, parentPath, selectionState, visitor) {
  normalizeGroups(groups).forEach((group, idx) => {
    const groupKey = resolveGroupKey(group, idx);
    const groupPath = makeGroupPath(parentPath, groupKey, idx, 'free');
    const options = Array.isArray(group?.options) ? group.options : [];
    const selectedKey = selectionState.free[groupPath];
    if (visitor?.onFreeGroup) {
      visitor.onFreeGroup({ group, groupPath, options, selectedKey });
    }
    const selectedIndex = options.findIndex((opt) => opt.key === selectedKey);
    if (selectedIndex >= 0) {
      const option = options[selectedIndex];
      const optionPath = makeOptionPath(groupPath, option.key, 'free', selectedIndex);
      if (visitor?.onFreeOption) {
        visitor.onFreeOption({ group, option, groupPath, optionPath });
      }
      traverseFreeGroups(option.childFreeOptionGroups, optionPath, selectionState, visitor);
      traverseExtraGroups(option.childExtraOptionGroups, optionPath, selectionState, visitor);
    }
  });
}

function traverseExtraGroups(groups, parentPath, selectionState, visitor) {
  normalizeGroups(groups).forEach((group, idx) => {
    const groupKey = resolveGroupKey(group, idx);
    const groupPath = makeGroupPath(parentPath, groupKey, idx, 'extra');
    const options = Array.isArray(group?.options) ? group.options : [];
    const selectedKeys = selectionState.extra[groupPath] instanceof Set
      ? selectionState.extra[groupPath]
      : new Set();
    if (visitor?.onExtraGroup) {
      visitor.onExtraGroup({ group, groupPath, options, selectedKeys });
    }
    options.forEach((option, optionIdx) => {
      if (!selectedKeys.has(option.key)) return;
      const optionPath = makeOptionPath(groupPath, option.key, 'extra', optionIdx);
      if (visitor?.onExtraOption) {
        visitor.onExtraOption({ group, option, groupPath, optionPath });
      }
      traverseFreeGroups(option.childFreeOptionGroups, optionPath, selectionState, visitor);
      traverseExtraGroups(option.childExtraOptionGroups, optionPath, selectionState, visitor);
    });
  });
}

function computeTotalExtraCost(extraGroups, freeGroups, selectionState) {
  let total = 0;
  const visitor = {
    onExtraOption: ({ option }) => {
      total += Number(option?.priceDelta || 0);
    },
  };
  traverseFreeGroups(freeGroups, '', selectionState, visitor);
  traverseExtraGroups(extraGroups, '', selectionState, visitor);
  return total;
}

function collectSelectedOptions(extraGroups, freeGroups, selectionState) {
  const selections = [];
  const visitor = {
    onFreeOption: ({ group, option, groupPath, optionPath }) => {
      selections.push({
        groupKey: group?.groupKey || groupPath,
        groupLabel: group?.groupLabel || groupPath,
        optionKey: option.key,
        optionLabel: option.label,
        priceDelta: 0,
        isFree: true,
        groupPath,
        optionPath,
      });
    },
    onExtraOption: ({ group, option, groupPath, optionPath }) => {
      selections.push({
        groupKey: group?.groupKey || groupPath,
        groupLabel: group?.groupLabel || groupPath,
        optionKey: option.key,
        optionLabel: option.label,
        priceDelta: Number(option?.priceDelta || 0),
        groupPath,
        optionPath,
      });
    },
  };
  traverseFreeGroups(freeGroups, '', selectionState, visitor);
  traverseExtraGroups(extraGroups, '', selectionState, visitor);
  return selections;
}

function selectionsAreValid(extraGroups, freeGroups, selectionState) {
  let valid = true;
  traverseFreeGroups(freeGroups, '', selectionState, {
    onFreeGroup: ({ group, options, selectedKey }) => {
      if (!valid) return;
      const isRequired = group?.isRequired === false ? false : true;
      if (isRequired && !options.some((opt) => opt.key === selectedKey)) {
        valid = false;
      }
    },
  });
  traverseExtraGroups(extraGroups, '', selectionState, {
    onExtraGroup: ({ group, options, selectedKeys }) => {
      if (!valid) return;
      const selectionType = group?.selectionType === 'multi' ? 'multi' : 'single';
      const { min, max } = clampSelections(selectionType, group?.minSelect, group?.maxSelect, options.length);
      const size = selectedKeys instanceof Set ? selectedKeys.size : 0;
      if (size < min) {
        valid = false;
        return;
      }
      if (max && max !== Infinity && size > max) {
        valid = false;
      }
    },
  });
  return valid;
}

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
  const freeGroups = useMemo(() => normalizeGroups(product?.freeOptionGroups), [product]);
  const extraGroups = useMemo(() => normalizeGroups(product?.extraOptionGroups), [product]);
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
  const [selectionState, setSelectionState] = useState(() => buildInitialSelectionState(extraGroups, freeGroups));

  const productId = product?._id || product?.id || '';

  useEffect(() => {
    if (!open) return;
    setSelectedVariantKey(() => (variants.length ? variants[0].key : ''));
    setSelectedFlavorKey(() => (flavors.length ? '' : ''));
    setSelectedPortionKey(() => (portions.length ? '' : ''));
    setSelectedQuantityKey(() => (quantities.length ? '' : ''));
    setQuantity(Math.max(1, Math.min(99, Number(initialQuantity) || 1)));
    setSelectionState(buildInitialSelectionState(extraGroups, freeGroups));
  }, [open, productId, variants, flavors, portions, quantities, extraGroups, freeGroups, initialQuantity]);

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

  const extraCost = useMemo(
    () => computeTotalExtraCost(extraGroups, freeGroups, selectionState),
    [extraGroups, freeGroups, selectionState]
  );

  const isVariantRequired = variants.length > 0;
  const flavorRequired = flavors.length > 0 && flavors.some((f) => f?.price !== undefined || f?.label);
  const portionRequired = portions.length > 0 && portions.some((p) => p?.price !== undefined || p?.label);
  const quantityRequired = quantities.length > 0 && quantities.some((q) => q?.price !== undefined || q?.label);
  const optionsValid = useMemo(
    () => selectionsAreValid(extraGroups, freeGroups, selectionState),
    [extraGroups, freeGroups, selectionState]
  );

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
    if (!optionsValid) return false;
    return quantity >= 1;
  }, [isVariantRequired, selectedVariantKey, flavorRequired, selectedFlavorKey, portionRequired, selectedPortionKey, quantityRequired, selectedQuantityKey, optionsValid, quantity]);

  const handleToggleOption = useCallback((groupPath, group, selectionType, min, max, option) => {
    setSelectionState((prev) => {
      const prevSet = prev.extra[groupPath] instanceof Set ? prev.extra[groupPath] : new Set();
      const nextSet = new Set(prevSet);
      const nextExtra = { ...prev.extra };
      const nextFree = { ...prev.free };
      const optionKey = option.key;
      const prevKeys = new Set(prevSet);

      if (selectionType === 'single') {
        if (nextSet.has(optionKey)) {
          if (min <= 0) {
            nextSet.clear();
          } else {
            return prev;
          }
        } else {
          nextSet.clear();
          nextSet.add(optionKey);
        }
      } else {
        if (nextSet.has(optionKey)) {
          nextSet.delete(optionKey);
          if (min > 0 && nextSet.size < min) {
            return prev;
          }
        } else {
          const limit = max && max !== Infinity ? max : Infinity;
          if (nextSet.size >= limit) {
            if (limit === Infinity || limit <= 0) {
              return prev;
            }
            const removedKeysForSpace = [];
            while (nextSet.size >= limit) {
              const iterator = nextSet.values();
              const firstKey = iterator.next().value;
              if (firstKey === undefined) break;
              nextSet.delete(firstKey);
              removedKeysForSpace.push(firstKey);
            }
            removedKeysForSpace.forEach((key) => {
              const replacedPath = makeOptionPath(groupPath, key, 'extra');
              clearSelectionsUnderPath(nextExtra, nextFree, replacedPath);
            });
            if (nextSet.size >= limit) {
              return prev;
            }
          }
          nextSet.add(optionKey);
        }
      }

      const removedKeys = [...prevKeys].filter((key) => !nextSet.has(key));
      removedKeys.forEach((key) => {
        const optionPath = makeOptionPath(groupPath, key, 'extra');
        clearSelectionsUnderPath(nextExtra, nextFree, optionPath);
      });

      const addedKeys = [...nextSet].filter((key) => !prevKeys.has(key));
      const groupOptions = Array.isArray(group?.options) ? group.options : [];
      addedKeys.forEach((key) => {
        const match = groupOptions.find((opt) => opt.key === key);
        if (!match) return;
        const optionPath = makeOptionPath(groupPath, key, 'extra');
        initializeFreeGroups(match.childFreeOptionGroups, optionPath, nextExtra, nextFree);
        initializeExtraGroups(match.childExtraOptionGroups, optionPath, nextExtra, nextFree);
      });

      if (removedKeys.length === 0 && addedKeys.length === 0 && nextSet.size === prevKeys.size) {
        return prev;
      }

      nextExtra[groupPath] = nextSet;
      return { extra: nextExtra, free: nextFree };
    });
  }, []);

  const handleSelectFreeOption = useCallback((groupPath, group, option) => {
    setSelectionState((prev) => {
      const nextExtra = { ...prev.extra };
      const nextFree = { ...prev.free };
      const prevSelectedKey = nextFree[groupPath] || '';
      if (prevSelectedKey === option.key) return prev;

      if (prevSelectedKey) {
        const prevOptionPath = makeOptionPath(groupPath, prevSelectedKey, 'free');
        clearSelectionsUnderPath(nextExtra, nextFree, prevOptionPath);
      }

      nextFree[groupPath] = option.key;
      const optionPath = makeOptionPath(groupPath, option.key, 'free');
      initializeFreeGroups(option.childFreeOptionGroups, optionPath, nextExtra, nextFree);
      initializeExtraGroups(option.childExtraOptionGroups, optionPath, nextExtra, nextFree);

      return { extra: nextExtra, free: nextFree };
    });
  }, []);

  function renderFreeGroups(groups, parentPath = '', depth = 0) {
    return normalizeGroups(groups).map((group, idx) => {
      const groupKey = resolveGroupKey(group, idx);
      const groupPath = makeGroupPath(parentPath, groupKey, idx, 'free');
      const options = Array.isArray(group?.options) ? group.options : [];
      if (!options.length) return null;
      const storedKey = selectionState.free[groupPath];
      const selectedKey = options.some((opt) => opt.key === storedKey)
        ? storedKey
        : options.find((opt) => opt?.isDefault)?.key || (options[0]?.key || '');
      const isRequired = group?.isRequired === false ? false : true;
      const badgeClass = isRequired ? 'extras-badge extras-badge--required' : 'extras-badge extras-badge--optional';
      const badgeText = isRequired ? 'Included (choose 1)' : 'Included (optional)';
      return (
        <section key={groupPath} className={`extras-group ${depth > 0 ? 'extras-group--nested' : ''}`}>
          <header className="extras-group__header">
            <div>
              <h4 className="extras-group__title">{group?.groupLabel || 'Included option'}</h4>
              {group?.helpText ? (
                <p className="extras-group__hint muted">{group.helpText}</p>
              ) : (
                <p className="extras-group__hint muted">Pick one option that's included in the price.</p>
              )}
            </div>
            <span className={badgeClass}>{badgeText}</span>
          </header>
          <div className="extras-options">
            {options.map((opt, optionIdx) => {
              const optionKey = opt?.key || `${groupPath}-${optionIdx}`;
              const optionPath = makeOptionPath(groupPath, opt?.key, 'free', optionIdx);
              const active = selectedKey === opt.key;
              const hasNestedChildren = hasAnyOptionsDeep(opt?.childFreeOptionGroups) || hasAnyOptionsDeep(opt?.childExtraOptionGroups);
              const nestedContent = hasNestedChildren
                ? [
                    ...renderFreeGroups(opt?.childFreeOptionGroups, optionPath, depth + 1),
                    ...renderExtraGroups(opt?.childExtraOptionGroups, optionPath, depth + 1),
                  ]
                    .filter(Boolean)
                : [];
              return (
                <div key={optionKey} className={`extras-option-block ${active ? 'extras-option-block--active' : ''}`}>
                  <label className={`extras-option ${active ? 'extras-option--active' : ''}`}>
                    <div className="extras-option__control">
                      <input
                        type="radio"
                        name={`free-${groupPath}`}
                        checked={active}
                        onChange={() => handleSelectFreeOption(groupPath, group, opt)}
                      />
                      <div className="extras-option__labels">
                        <span>{opt.label}</span>
                        {hasNestedChildren ? (
                          <span className="extras-option__subtext">Sub options available</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="extras-option__price" data-included="true">Included</div>
                  </label>
                  {nestedContent.length ? (
                    <div
                      className={`extras-option__nested extras-nested extras-collapse ${active ? 'extras-collapse--open' : ''}`}
                      aria-hidden={!active}
                    >
                      {nestedContent}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      );
    }).filter(Boolean);
  }

  function renderExtraGroups(groups, parentPath = '', depth = 0) {
    return normalizeGroups(groups).map((group, idx) => {
      const groupKey = resolveGroupKey(group, idx);
      const groupPath = makeGroupPath(parentPath, groupKey, idx, 'extra');
      const options = Array.isArray(group?.options) ? group.options : [];
      if (!options.length) return null;
      const selectionType = group?.selectionType === 'multi' ? 'multi' : 'single';
      const { min, max } = clampSelections(selectionType, group?.minSelect, group?.maxSelect, options.length);
      const selectedKeys = selectionState.extra[groupPath] instanceof Set
        ? selectionState.extra[groupPath]
        : new Set();
      const isRequired = selectionType === 'single' || min > 0;
      const badgeText = selectionType === 'single'
        ? 'Required'
        : (min > 0 ? `Choose at least ${min}` : 'Optional');
      const maxText = max && max !== Infinity && selectionType === 'multi' ? ` (up to ${max})` : '';
      return (
        <section key={groupPath} className={`extras-group ${depth > 0 ? 'extras-group--nested' : ''}`}>
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
            {options.map((opt, optionIdx) => {
              const optionKey = opt?.key || `${groupPath}-${optionIdx}`;
              const optionPath = makeOptionPath(groupPath, opt?.key, 'extra', optionIdx);
              const active = selectedKeys.has(opt.key);
              const hasNestedChildren = hasAnyOptionsDeep(opt?.childFreeOptionGroups) || hasAnyOptionsDeep(opt?.childExtraOptionGroups);
              const nestedContent = hasNestedChildren
                ? [
                    ...renderFreeGroups(opt.childFreeOptionGroups, optionPath, depth + 1),
                    ...renderExtraGroups(opt.childExtraOptionGroups, optionPath, depth + 1),
                  ]
                    .filter(Boolean)
                : [];
              const price = Number(opt?.priceDelta || 0);
              return (
                <div key={optionKey} className={`extras-option-block ${active ? 'extras-option-block--active' : ''}`}>
                  <label className={`extras-option ${active ? 'extras-option--active' : ''}`}>
                    <div className="extras-option__control">
                      <input
                        type={selectionType === 'single' ? 'radio' : 'checkbox'}
                        name={selectionType === 'single' ? `group-${groupPath}` : undefined}
                        checked={active}
                        onChange={() => handleToggleOption(groupPath, group, selectionType, min, max, opt)}
                      />
                      <div className="extras-option__labels">
                        <span>{opt.label}</span>
                        {hasNestedChildren ? (
                          <span className="extras-option__subtext">Sub options available</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="extras-option__price" data-included={price === 0 ? 'true' : 'false'}>
                      {price ? `+${currency(price)}` : 'Included'}
                    </div>
                  </label>
                  {nestedContent.length ? (
                    <div
                      className={`extras-option__nested extras-nested extras-collapse ${active ? 'extras-collapse--open' : ''}`}
                      aria-hidden={!active}
                    >
                      {nestedContent}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      );
    }).filter(Boolean);
  }

  const handleConfirm = () => {
    const selectedOptions = collectSelectedOptions(extraGroups, freeGroups, selectionState);
    onConfirm({
      quantity,
      variant: selectedVariant || undefined,
      flavor: selectedFlavor || undefined,
      portion: selectedPortion || undefined,
      quantityOption: selectedQuantityOption || undefined,
      selectedOptions,
    });
  };

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
            {(productDescription || extraGroups.length || variants.length || flavors.length || portions.length || quantities.length) ? (
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
                    <label key={variant.key} className={`extras-option ${active ? 'extras-option--active' : ''}`}>
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

          {renderFreeGroups(freeGroups)}
          {renderExtraGroups(extraGroups)}

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
                    <label key={flavor.key} className={`extras-option ${active ? 'extras-option--active' : ''}`}>
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
                    <label key={portion.key} className={`extras-option ${active ? 'extras-option--active' : ''}`}>
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
                    <label key={quantityOption.key} className={`extras-option ${active ? 'extras-option--active' : ''}`}>
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

