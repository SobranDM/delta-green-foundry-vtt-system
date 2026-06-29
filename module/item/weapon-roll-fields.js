/**
 * Shared weapon damage/lethality field checks for templates and inventory rolls.
 * @param {string|number|null|undefined} damage
 * @returns {boolean}
 */
export function hasWeaponDamage(damage) {
  const trimmed = String(damage ?? "").trim();
  return trimmed !== "" && trimmed !== "0";
}

/**
 * @param {string|number|null|undefined} lethality
 * @returns {boolean}
 */
export function hasWeaponLethality(lethality) {
  const value = Number(lethality);
  return Number.isFinite(value) && value > 0;
}

/**
 * @param {Item|object} item
 * @returns {boolean}
 */
export function hasWeaponDamageAndLethality(item) {
  return (
    hasWeaponDamage(item?.system?.damage) &&
    hasWeaponLethality(item?.system?.lethality)
  );
}
