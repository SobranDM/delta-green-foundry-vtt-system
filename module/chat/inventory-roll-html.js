import { getPercentileRollResultPresentation } from "../roll/percentile-result-presentation.js";

const { renderTemplate } = foundry.applications.handlebars;

/**
 * @param {DGPercentileRoll} roll
 * @param {object} [options]
 * @param {boolean} [options.showWeaponFollowUp]
 * @param {boolean} [options.hasDamageRoll]
 * @param {boolean} [options.hasLethalityRoll]
 * @param {string} [options.weaponItemId]
 * @returns {Promise<string>}
 */
export async function renderPercentileRollHtml(
  roll,
  {
    showWeaponFollowUp = false,
    hasDamageRoll = false,
    hasLethalityRoll = false,
    weaponItemId = "",
  } = {},
) {
  const { resultString, resultClass } = getPercentileRollResultPresentation(
    roll.isSuccess,
    roll.isCritical,
  );

  return renderTemplate(
    "systems/deltagreen/templates/roll/percentile-roll.hbs",
    {
      resultClass,
      resultString,
      formula: roll.formula,
      total: roll.total,
      failureMark: false,
      sanityChoiceLabel: null,
      showWeaponFollowUp,
      hasDamageRoll,
      hasLethalityRoll,
      weaponItemId,
    },
  );
}

/**
 * @param {DGSanityDamageRoll} roll
 * @returns {Promise<string>}
 */
export async function renderSanityDamageRollHtml(roll) {
  if (!roll._evaluated) await roll.evaluate();

  const [lowDie, highDie] = roll.terms[0].terms.map((formula) => {
    return (
      Roll.parse(formula)[0] || {
        faces: Number(formula),
        number: 1,
      }
    );
  });
  const [lowResult, highResult] = roll.damageResults;

  return renderTemplate(
    "systems/deltagreen/templates/roll/sanity-damage-roll.hbs",
    {
      lowFormula: lowDie.formula,
      highFormula: highDie.formula,
      lowFaces: lowDie.faces,
      highFaces: highDie.faces,
      lowResult,
      highResult,
    },
  );
}

/**
 * Whether a sanity-loss formula should produce a chat roll (non-empty and not constant zero).
 * @param {string} formula
 * @returns {boolean}
 */
export function isSubstantiveSanityLossFormula(formula) {
  const trimmed = String(formula ?? "").trim();
  if (!trimmed) return false;
  try {
    const roll = new Roll(trimmed);
    if (roll.dice.length > 0) return true;
    roll.evaluateSync();
    return roll.total !== 0;
  } catch {
    return true;
  }
}

/**
 * @param {string} formula
 * @returns {Promise<{ html: string, total: number }>}
 */
export async function renderFormulaRollHtml(formula) {
  const roll = new Roll(String(formula));
  await roll.evaluate();
  return { html: await roll.render(), total: roll.total };
}

/**
 * @param {string} labelKey i18n key for the roll section heading
 * @param {string} html Evaluated roll HTML
 * @param {object} [options]
 * @param {"sanity-loss"} [options.variant] Optional layout variant
 * @returns {string}
 */
export function wrapLabeledInventoryRollHtml(labelKey, html, { variant } = {}) {
  if (!html?.trim()) return "";
  const label = game.i18n.localize(labelKey);
  if (variant === "sanity-loss") {
    return `<div class="inventory-chat-roll-section inventory-chat-sanity-loss-section"><hr class="inventory-ritual-divider inventory-chat-sanity-loss-divider" /><div class="inventory-chat-sanity-loss-header">${label}</div>${html}<hr class="inventory-ritual-divider inventory-chat-sanity-loss-divider inventory-chat-sanity-loss-divider--after-roll" /></div>`;
  }
  return `<div class="inventory-chat-roll-section"><div class="inventory-chat-header-row"><span class="inventory-chat-header-label">${label}</span></div>${html}</div>`;
}

/**
 * @param {string} formula
 * @returns {Promise<string>}
 */
export async function renderLabeledSanityLossRollHtml(formula) {
  if (!isSubstantiveSanityLossFormula(formula)) return "";
  const { html } = await renderFormulaRollHtml(formula);
  return wrapLabeledInventoryRollHtml("DG.Inventory.SanityLoss", html, {
    variant: "sanity-loss",
  });
}
