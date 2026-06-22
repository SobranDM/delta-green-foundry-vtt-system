/**
 * Mark a nested object key for forced deletion in a Document update payload.
 * v14+ uses foundry.data.operators.ForcedDeletion; v13 uses legacy `-=key` syntax.
 *
 * @param {Record<string, unknown>} parentUpdate
 * @param {string} key
 */
export function markForDeletion(parentUpdate, key) {
  if (foundry.data.operators?.ForcedDeletion) {
    parentUpdate[key] = new foundry.data.operators.ForcedDeletion();
  } else {
    parentUpdate[`-=${key}`] = null;
  }
}
