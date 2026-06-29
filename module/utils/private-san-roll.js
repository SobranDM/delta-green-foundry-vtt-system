import DG from "../config/index.js";
import { getDefaultRollMessageMode } from "./message-mode.js";

/**
 * Whether a percentile roll should be blinded for the current user under keepSanityPrivate.
 * @param {object} params
 * @param {string} [params.rollType]
 * @param {string} [params.key]
 * @param {boolean} [params.isGM]
 * @returns {boolean}
 */
export function shouldBlindPrivateSanRoll({
  rollType,
  key,
  isGM = game.user.isGM,
} = {}) {
  if (isGM) return false;
  if (!game.settings.get(DG.ID, "keepSanityPrivate")) return false;
  return rollType === "sanity" || key === "ritual";
}

/**
 * Resolve chat message mode for a SAN-related percentile roll.
 * keepSanityPrivate forces blind for non-GMs; otherwise uses preferred mode.
 * @param {string|undefined|null} preferredMode
 * @param {object} rollContext
 * @param {string} [rollContext.rollType]
 * @param {string} [rollContext.key]
 * @returns {string}
 */
export function resolvePrivateSanRollMessageMode(
  preferredMode,
  { rollType, key } = {},
) {
  if (shouldBlindPrivateSanRoll({ rollType, key })) return "blind";
  return preferredMode ?? getDefaultRollMessageMode();
}

/**
 * Apply keepSanityPrivate blind mode to a percentile roll's options when required.
 * @param {DGPercentileRoll} roll
 * @returns {void}
 */
export function applyPrivateSanRollMessageMode(roll) {
  roll.options.messageMode = resolvePrivateSanRollMessageMode(
    roll.options.messageMode,
    { rollType: roll.type, key: roll.key },
  );
}
