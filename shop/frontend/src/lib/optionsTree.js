const GROUP_PREFIX = { extra: 'eg', free: 'fg' };
const OPTION_PREFIX = { extra: 'eo', free: 'fo' };

function normalizeKey(value, fallback) {
  const str = String(value || '').trim();
  return str || fallback;
}

export function normalizeGroups(input) {
  return Array.isArray(input) ? input : [];
}

export function resolveGroupKey(group, idx = 0) {
  if (group?.groupKey) return String(group.groupKey).trim();
  if (group?.groupLabel) return String(group.groupLabel).trim();
  return `group_${idx}`;
}

export function clampSelections(selectionType, minSelect = 0, maxSelect = 0, optionsLength = 0) {
  if (selectionType === 'single') {
    return { min: 1, max: 1 };
  }
  const min = Math.max(0, Number(minSelect) || 0);
  const rawMax = Math.max(0, Number(maxSelect) || 0);
  let max = rawMax || optionsLength || 0;
  if (max && optionsLength && max > optionsLength) max = optionsLength;
  if (max === 0) return { min, max: optionsLength || min || Infinity };
  return {
    min: Math.min(min, max),
    max: Math.max(min || 0, max),
  };
}

export function makeGroupPath(parentPath, groupKey, idx = 0, mode = 'extra') {
  const prefix = GROUP_PREFIX[mode] || 'g';
  const safeKey = normalizeKey(groupKey, `${mode}_group_${idx}`);
  const segment = `${prefix}:${safeKey}`;
  return parentPath ? `${parentPath}__${segment}` : segment;
}

export function makeOptionPath(parentPath, optionKey, mode = 'extra', idx = 0) {
  const prefix = OPTION_PREFIX[mode] || 'o';
  const safeKey = normalizeKey(optionKey, `${mode}_option_${idx}`);
  const segment = `${prefix}:${safeKey}`;
  return parentPath ? `${parentPath}__${segment}` : segment;
}

export function hasAnyOptionsDeep(groups) {
  return normalizeGroups(groups).some((group) => {
    const options = Array.isArray(group?.options) ? group.options : [];
    if (options.length > 0) return true;
    return options.some((opt) =>
      hasAnyOptionsDeep(opt?.childExtraOptionGroups)
      || hasAnyOptionsDeep(opt?.childFreeOptionGroups)
    );
  });
}

