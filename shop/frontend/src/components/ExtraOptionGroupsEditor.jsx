import React from 'react';

function slugify(value, fallback) {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || fallback;
}

function generateUniqueKey(base, existingKeys, fallback = 'group') {
  const initial = slugify(base, fallback);
  let candidate = initial;
  let i = 1;
  while (existingKeys.has(candidate)) {
    candidate = `${initial}_${i++}`;
  }
  return candidate;
}

function normalizeGroups(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeGroupsForMode(input, mode) {
  return normalizeGroups(input).map((group) => {
    const options = Array.isArray(group?.options) ? group.options : [];
    const sanitizedOptions = options.map((opt) => {
      const childExtraOptionGroups = sanitizeGroupsForMode(opt?.childExtraOptionGroups, 'extra');
      const childFreeOptionGroups = sanitizeGroupsForMode(opt?.childFreeOptionGroups, 'free');
      const delta = Number(opt?.priceDelta);
      return {
        ...opt,
        priceDelta: mode === 'free' ? 0 : (Number.isFinite(delta) ? delta : 0),
        childExtraOptionGroups,
        childFreeOptionGroups,
      };
    });

    if (mode === 'free') {
      const isRequired = group?.isRequired === false ? false : true;
      if (sanitizedOptions.length) {
        let defaultIndex = sanitizedOptions.findIndex((opt) => opt?.isDefault);
        if (defaultIndex < 0) defaultIndex = 0;
        sanitizedOptions.forEach((opt, optionIdx) => {
          opt.priceDelta = 0;
          opt.isDefault = optionIdx === defaultIndex;
        });
      }
      return {
        ...group,
        options: sanitizedOptions,
        selectionType: 'single',
        isRequired,
        minSelect: isRequired ? 1 : 0,
        maxSelect: 1,
      };
    }

    return {
      ...group,
      options: sanitizedOptions,
    };
  });
}

export const ExtraOptionGroupsEditor = ({
  value,
  onChange,
  mode = 'extra',
  depth = 0,
  parentKeyBase = 'group',
  addGroupLabel,
  addOptionLabel,
}) => {
  const isFreeMode = mode === 'free';
  const isNested = depth > 0;

  const derivedAddGroupLabel = addGroupLabel || (depth === 0
    ? '+ Add option group'
    : depth === 1
      ? '+ Add sub option'
      : '+ Add nested option group');

  const derivedAddOptionLabel = addOptionLabel || (depth === 0
    ? '+ Add option'
    : depth === 1
      ? '+ Add their option'
      : '+ Add nested option');

  const cleanGroupActionLabel = derivedAddGroupLabel.replace(/^\+\s*/, '').trim();

  const emptyStateMessage = (() => {
    if (!isNested) {
      return `No custom option groups yet. Click "${cleanGroupActionLabel}" to create one.`;
    }
    if (depth === 1) {
      return `No sub options yet. Click "${cleanGroupActionLabel}" to create one.`;
    }
    return `No nested options yet. Click "${cleanGroupActionLabel}" to create one.`;
  })();

  const sanitizeForMode = React.useCallback((input) => sanitizeGroupsForMode(input, isFreeMode ? 'free' : 'extra'), [isFreeMode]);

  const groups = React.useMemo(() => sanitizeForMode(value), [value, sanitizeForMode]);

  const showGroupKeyField = !isNested;
  const showGroupHelpTextField = !isNested;
  const showOptionKeyField = !isNested;

  const optionColumns = (() => {
    if (showOptionKeyField) {
      return isFreeMode
        ? 'minmax(0, 1fr) 160px 140px auto'
        : 'minmax(0, 1fr) 120px 120px auto';
    }
    return isFreeMode
      ? 'minmax(0, 1fr) 140px auto auto'
      : 'minmax(0, 1fr) 120px auto auto';
  })();

  const setGroups = React.useCallback((next) => {
    if (typeof onChange === 'function') {
      onChange(sanitizeForMode(next));
    }
  }, [onChange, sanitizeForMode]);

  const createEmptyGroup = React.useCallback((existingGroups, baseOverride) => {
    const list = Array.isArray(existingGroups) ? existingGroups : [];
    const existingKeys = new Set(list.map((g) => g?.groupKey).filter(Boolean));
    const baseName = baseOverride || parentKeyBase || 'group';
    const groupBase = `${baseName}_group`;
    const groupKey = generateUniqueKey(groupBase, existingKeys, 'group');
    return {
      groupKey,
      groupLabel: '',
      selectionType: 'single',
      isRequired: true,
      helpText: '',
      minSelect: 1,
      maxSelect: 1,
      options: [
        {
          key: `${groupKey}_option`,
          label: '',
          priceDelta: 0,
          isDefault: true,
        },
      ],
    };
  }, [parentKeyBase]);

  const updateGroup = (index, updater) => {
    setGroups(groups.map((group, idx) => (idx === index ? updater(group) : group)));
  };

  const updateOption = (groupIdx, optionIdx, updater) => {
    updateGroup(groupIdx, (group) => {
      const options = Array.isArray(group?.options) ? group.options : [];
      const nextOptions = options.map((opt, idx) => (idx === optionIdx ? updater(opt) : opt));
      return { ...group, options: nextOptions };
    });
  };

  const handleAddGroup = () => {
    const nextGroup = createEmptyGroup(groups);
    const next = [
      ...groups,
      nextGroup,
    ];
    setGroups(next);
  };

  const handleRemoveGroup = (index) => {
    const next = groups.filter((_, idx) => idx !== index);
    setGroups(next);
  };

  const handleAddOption = (groupIdx) => {
    updateGroup(groupIdx, (group) => {
      const options = Array.isArray(group?.options) ? group.options : [];
      const existingKeys = new Set(options.map((o) => o?.key).filter(Boolean));
      const base = group?.groupKey ? `${group.groupKey}_option` : 'option';
      const newKey = generateUniqueKey(base, existingKeys, 'option');
      const selectionType = group?.selectionType === 'single' ? 'single' : 'multi';
      const nextOptions = [
        ...options,
        {
          key: newKey,
          label: '',
          priceDelta: 0,
          isDefault: selectionType === 'single' && options.every((opt) => !opt?.isDefault),
        },
      ];
      const nextGroup = { ...group, options: nextOptions };
      if (selectionType === 'single') {
        nextGroup.minSelect = 1;
        nextGroup.maxSelect = 1;
        nextGroup.isRequired = true;
      }
      return nextGroup;
    });
  };

  const handleRemoveOption = (groupIdx, optionIdx) => {
    updateGroup(groupIdx, (group) => {
      const options = Array.isArray(group?.options) ? group.options : [];
      const nextOptions = options.filter((_, idx) => idx !== optionIdx);
      let nextGroup = { ...group, options: nextOptions };
      if ((group?.selectionType === 'single') && !nextOptions.some((opt) => opt?.isDefault)) {
        nextGroup = {
          ...nextGroup,
          options: nextOptions.map((opt, idx) => ({ ...opt, isDefault: idx === 0 })),
        };
      }
      if (nextGroup.selectionType === 'single') {
        nextGroup.minSelect = 1;
        nextGroup.maxSelect = 1;
      } else {
        const max = Math.max(0, Number(nextGroup.maxSelect) || nextOptions.length);
        nextGroup.maxSelect = Math.max(0, Math.min(max, nextOptions.length));
        const min = Math.max(0, Number(nextGroup.minSelect) || 0);
        nextGroup.minSelect = Math.min(min, nextGroup.maxSelect);
      }
      return nextGroup;
    });
  };

  const handleSelectionTypeChange = (groupIdx, selectionType) => {
    if (isFreeMode) return;
    updateGroup(groupIdx, (group) => {
      const options = Array.isArray(group?.options) ? group.options : [];
      if (selectionType === 'single') {
        return {
          ...group,
          selectionType: 'single',
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          options: options.map((opt, idx) => ({ ...opt, isDefault: idx === 0 })),
        };
      }
      const minSelect = Math.max(0, Number(group?.minSelect) || 0);
      const maxSelect = Math.max(0, Number(group?.maxSelect) || options.length);
      return {
        ...group,
        selectionType: 'multi',
        isRequired: minSelect > 0,
        minSelect,
        maxSelect: Math.max(minSelect, maxSelect || options.length),
        options,
      };
    });
  };

  const containerStyle = isNested
    ? {
        display: 'grid',
        gap: 10,
        padding: 10,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--panel-1)',
      }
    : {
        display: 'grid',
        gap: 12,
      };

  const groupCardStyle = isNested
    ? {
        padding: 10,
        borderRadius: 10,
        border: '1px dashed var(--border)',
        background: '#fff',
        display: 'grid',
        gap: 8,
      }
    : {
        padding: 12,
        borderRadius: 12,
        border: '1px solid var(--border)',
        display: 'grid',
        gap: 10,
      };

  const cardClassName = isNested ? undefined : 'card';

  const headerTitle = depth === 0 ? 'Option group' : depth === 1 ? 'Sub option group' : 'Nested option group';

  return (
    <div style={containerStyle}>
      {groups.length === 0 ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {emptyStateMessage}
        </div>
      ) : null}
      {groups.map((group, groupIdx) => {
        const options = Array.isArray(group?.options) ? group.options : [];
        return (
          <div key={group?.groupKey || groupIdx} className={cardClassName} style={groupCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>{headerTitle} #{groupIdx + 1}</div>
              <button className="danger" onClick={() => handleRemoveGroup(groupIdx)}>Remove group</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Label</span>
                <input
                  value={group?.groupLabel || ''}
                  onChange={(e) => {
                    const label = e.target.value;
                    updateGroup(groupIdx, (prev) => {
                      const existingKeys = new Set(groups.map((g, idx) => (idx === groupIdx ? null : g?.groupKey)).filter(Boolean));
                      let groupKey = prev?.groupKey;
                      if (!groupKey || /^group(_\d+)?$/.test(groupKey)) {
                        groupKey = generateUniqueKey(label, existingKeys, 'group');
                      }
                      return { ...prev, groupLabel: label, groupKey };
                    });
                  }}
                />
              </label>
              {showGroupKeyField ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Key</span>
                  <input
                    value={group?.groupKey || ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateGroup(groupIdx, (prev) => {
                        const existingKeys = new Set(groups.map((g, idx) => (idx === groupIdx ? null : g?.groupKey)).filter(Boolean));
                        const candidate = generateUniqueKey(raw, existingKeys, 'group');
                        return { ...prev, groupKey: candidate };
                      });
                    }}
                  />
                </label>
              ) : null}
              {!isFreeMode ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Selection type</span>
                  <select
                    value={group?.selectionType === 'multi' ? 'multi' : 'single'}
                    onChange={(e) => handleSelectionTypeChange(groupIdx, e.target.value === 'multi' ? 'multi' : 'single')}
                  >
                    <option value="single">Single choice (radio)</option>
                    <option value="multi">Multiple choice (checkbox)</option>
                  </select>
                </label>
              ) : null}
              {showGroupHelpTextField ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Help text (optional)</span>
                  <input
                    value={group?.helpText || ''}
                    onChange={(e) => updateGroup(groupIdx, (prev) => ({ ...prev, helpText: e.target.value }))}
                    placeholder="Shown under group title"
                  />
                </label>
              ) : null}
            </div>
            {!isFreeMode ? (
              group?.selectionType === 'multi' ? (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Minimum selections</span>
                    <input
                      type="number"
                      min={0}
                      value={Number(group?.minSelect || 0)}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        updateGroup(groupIdx, (prev) => {
                          const max = Math.max(val, Number(prev?.maxSelect) || options.length || val);
                          return {
                            ...prev,
                            minSelect: Math.min(val, max),
                            maxSelect: max,
                            isRequired: val > 0,
                          };
                        });
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Maximum selections</span>
                    <input
                      type="number"
                      min={0}
                      value={Number(group?.maxSelect || options.length || 0)}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        updateGroup(groupIdx, (prev) => {
                          const min = Math.max(0, Number(prev?.minSelect) || 0);
                          const clamped = Math.min(Math.max(val, min), options.length || val);
                          return { ...prev, maxSelect: clamped };
                        });
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!group?.isRequired}
                      onChange={(e) => updateGroup(groupIdx, (prev) => ({ ...prev, isRequired: e.target.checked, minSelect: e.target.checked ? Math.max(1, Number(prev?.minSelect) || 1) : Math.max(0, Number(prev?.minSelect) || 0) }))}
                    />
                    <span>Required</span>
                  </label>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>
                  Single choice groups are always required. The first option will be selected by default unless another option is marked as default.
                </div>
              )
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                Customers can pick one included option. Additional selections are not allowed.
              </div>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Options</div>
              {options.length === 0 ? (
                <div className="muted" style={{ fontSize: 12 }}>No options yet.</div>
              ) : null}
              {options.map((option, optionIdx) => {
                const optionKey = option?.key || `${groupIdx}-${optionIdx}`;
                const extraCount = Array.isArray(option?.childExtraOptionGroups) ? option.childExtraOptionGroups.length : 0;
                const freeCount = Array.isArray(option?.childFreeOptionGroups) ? option.childFreeOptionGroups.length : 0;
                const optionParentKeyBase = optionKey || `${group?.groupKey || 'group'}_${optionIdx}`;
                return (
                  <React.Fragment key={`${groupIdx}-${optionKey}`}>
                    <div style={{ display: 'grid', gridTemplateColumns: optionColumns, gap: 8, alignItems: 'center' }}>
                      <input
                        placeholder="Label"
                        value={option?.label || ''}
                        onChange={(e) => {
                          const label = e.target.value;
                          updateOption(groupIdx, optionIdx, (prev) => {
                            const optionsForGroup = Array.isArray(group?.options) ? group.options : [];
                            const existingKeys = new Set(optionsForGroup.map((opt, idx) => (idx === optionIdx ? null : opt?.key)).filter(Boolean));
                            let key = prev?.key;
                            if (!key || /^option(_\d+)?$/.test(key) || key.startsWith(`${group?.groupKey || 'group'}_option`)) {
                              key = generateUniqueKey(`${group?.groupKey || 'group'}_${label}`, existingKeys, 'option');
                            }
                            return { ...prev, label, key };
                          });
                        }}
                      />
                      {showOptionKeyField ? (
                        <input
                          placeholder="Key"
                          value={option?.key || ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updateOption(groupIdx, optionIdx, (prev) => {
                              const optionsForGroup = Array.isArray(group?.options) ? group.options : [];
                              const existingKeys = new Set(optionsForGroup.map((opt, idx) => (idx === optionIdx ? null : opt?.key)).filter(Boolean));
                              const key = generateUniqueKey(raw, existingKeys, 'option');
                              return { ...prev, key };
                            });
                          }}
                        />
                      ) : null}
                      {isFreeMode ? (
                        <div className="muted" style={{ fontSize: 12 }}>Included</div>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price +/?"
                          value={Number(option?.priceDelta || 0)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateOption(groupIdx, optionIdx, (prev) => ({ ...prev, priceDelta: Number.isFinite(val) ? val : 0 }));
                          }}
                        />
                      )}
                      {group?.selectionType === 'single' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <input
                            type="radio"
                            name={`default-${groupIdx}`}
                            checked={!!option?.isDefault}
                            onChange={() => {
                              updateGroup(groupIdx, (prev) => ({
                                ...prev,
                                options: (Array.isArray(prev.options) ? prev.options : []).map((opt, idx) => ({ ...opt, isDefault: idx === optionIdx })),
                              }));
                            }}
                          />
                          <span style={{ fontSize: 12 }}>Default</span>
                        </label>
                      ) : (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!option?.isDefault}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateOption(groupIdx, optionIdx, (prev) => ({ ...prev, isDefault: checked }));
                            }}
                          />
                          <span style={{ fontSize: 12 }}>Default selected</span>
                        </label>
                      )}
                      <button className="danger" onClick={() => handleRemoveOption(groupIdx, optionIdx)}>Remove</button>
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10, marginTop: 10 }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Sub options</span>
                          <span className="muted" style={{ fontSize: 11 }}>({extraCount})</span>
                        </div>
                        <ExtraOptionGroupsEditor
                          value={option?.childExtraOptionGroups || []}
                          onChange={(nextGroups) => updateOption(groupIdx, optionIdx, (prev) => ({ ...prev, childExtraOptionGroups: nextGroups }))}
                          depth={depth + 1}
                          parentKeyBase={`${optionParentKeyBase}_extra`}
                          addGroupLabel="+ Add sub option"
                          addOptionLabel="+ Add their option"
                        />
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Included sub options</span>
                          <span className="muted" style={{ fontSize: 11 }}>({freeCount})</span>
                        </div>
                        <ExtraOptionGroupsEditor
                          mode="free"
                          value={option?.childFreeOptionGroups || []}
                          onChange={(nextGroups) => updateOption(groupIdx, optionIdx, (prev) => ({ ...prev, childFreeOptionGroups: nextGroups }))}
                          depth={depth + 1}
                          parentKeyBase={`${optionParentKeyBase}_free`}
                          addGroupLabel="+ Add included sub option"
                          addOptionLabel="+ Add their option"
                        />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <button onClick={() => handleAddOption(groupIdx)}>{derivedAddOptionLabel}</button>
            </div>
          </div>
        );
      })}
      <div>
        <button onClick={handleAddGroup} className={depth === 0 ? 'primary-btn' : undefined}>{derivedAddGroupLabel}</button>
      </div>
    </div>
  );
};

