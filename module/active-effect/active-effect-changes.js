/**
 * v14 stores Active Effect changes on `system.changes`; v13 uses top-level `changes`.
 * @returns {boolean}
 */
export function usesSystemChanges() {
  return Boolean(foundry.data?.ActiveEffectTypeDataModel);
}

/**
 * @param {ActiveEffect} effect
 * @returns {object[]}
 */
export function getActiveEffectChanges(effect) {
  if (usesSystemChanges()) {
    return effect.system?.changes ?? [];
  }
  return effect.changes ?? [];
}

/**
 * @param {object[]} changes
 * @returns {{ changes: object[] } | { system: { changes: object[] } }}
 */
export function buildActiveEffectChangesUpdate(changes) {
  if (usesSystemChanges()) {
    return { system: { changes } };
  }
  return { changes };
}

/**
 * @param {number} index
 * @param {string} fieldName
 * @returns {string}
 */
export function getActiveEffectChangeFieldPath(index, fieldName) {
  const prefix = usesSystemChanges() ? "system.changes" : "changes";
  return `${prefix}.${index}.${fieldName}`;
}
