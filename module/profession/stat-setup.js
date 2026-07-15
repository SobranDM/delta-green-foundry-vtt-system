import DG from "../config/index.js";
import { showDiceSoNicePooledRolls } from "../integrations/dice-so-nice.js";

export const STAT_KEYS = DG.statistics;
export const POINT_BUY_TOTAL = 72;
export const STAT_MIN = 3;
export const STAT_MAX = 18;
export const ROLL_STAT_FORMULA = "4d6dl";

/**
 * @param {string} key
 * @returns {string}
 */
export function getStatisticLabel(key) {
  return game.i18n.localize(`DG.Attributes.${key}`);
}

/**
 * @returns {{ key: string, label: string }[]}
 */
export function buildStatisticRows() {
  return STAT_KEYS.map((key) => ({
    key,
    label: getStatisticLabel(key),
  }));
}

/**
 * @param {Actor} actor
 * @param {Record<string, number>} valuesByKey
 * @returns {Promise<void>}
 */
export async function applyAgentStatistics(actor, valuesByKey) {
  const updateData = {};
  for (const key of STAT_KEYS) {
    updateData[`system.statistics.${key}.value`] = valuesByKey[key];
  }
  await actor.update(updateData);
}

/**
 * @param {Record<string, number>} values
 * @returns {number}
 */
export function computePointsRemaining(values) {
  let sum = 0;
  for (const key of STAT_KEYS) {
    const value = Number(values[key]);
    if (Number.isFinite(value)) sum += Math.trunc(value);
  }
  return POINT_BUY_TOTAL - sum;
}

/**
 * @param {Record<string, number>} values
 * @returns {{ isValid: boolean, remaining: number, invalidKeys: string[], allStatsValid: boolean }}
 */
function evaluatePointBuyValues(values) {
  let sum = 0;
  /** @type {number | null} */
  let remainingAtFirstInvalid = null;
  /** @type {string[]} */
  const invalidKeys = [];

  for (const key of STAT_KEYS) {
    const value = Number(values[key]);
    if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX) {
      if (remainingAtFirstInvalid === null) {
        remainingAtFirstInvalid = POINT_BUY_TOTAL - sum;
      }
      invalidKeys.push(key);
    } else {
      sum += value;
    }
  }

  const remaining = POINT_BUY_TOTAL - sum;
  const allStatsValid = invalidKeys.length === 0;
  return {
    isValid: allStatsValid && remaining === 0,
    remaining: allStatsValid
      ? remaining
      : remainingAtFirstInvalid ?? POINT_BUY_TOTAL,
    invalidKeys,
    allStatsValid,
  };
}

/**
 * @param {Record<string, number>} values
 * @returns {string[]}
 */
export function getPointBuyInvalidKeys(values) {
  return evaluatePointBuyValues(values).invalidKeys;
}

/**
 * @param {Record<string, number>} values
 * @returns {string[]}
 */
export function buildPointBuyValidationMessages(values) {
  const { invalidKeys, allStatsValid, remaining } =
    evaluatePointBuyValues(values);
  /** @type {string[]} */
  const messages = invalidKeys.map((key) =>
    game.i18n.format("DG.ProfessionSetup.AssignStats.ErrorInvalidStat", {
      stat: getStatisticLabel(key),
      min: STAT_MIN,
      max: STAT_MAX,
    }),
  );

  if (allStatsValid && remaining !== 0) {
    messages.push(
      game.i18n.format("DG.ProfessionSetup.AssignStats.ErrorPointsRemaining", {
        remaining,
      }),
    );
  }

  return messages;
}

/**
 * @param {Record<string, number>} values
 * @returns {{ isValid: boolean, remaining: number }}
 */
export function validatePointBuyValues(values) {
  const { isValid, remaining } = evaluatePointBuyValues(values);
  return { isValid, remaining };
}

/**
 * @param {object} [options]
 * @param {Actor|null} [options.actor]
 * @param {TokenDocument|null} [options.token]
 * @param {boolean} [options.animate=true]
 * @returns {Promise<{ total: number, roll: Roll }[]>}
 */
export async function rollStatisticScores({
  actor = null,
  token = null,
  animate = true,
} = {}) {
  const rollPromises = [];
  for (let i = 0; i < STAT_KEYS.length; i++) {
    rollPromises.push(new Roll(ROLL_STAT_FORMULA).evaluate());
  }
  const rolls = await Promise.all(rollPromises);

  if (animate) {
    await showDiceSoNicePooledRolls(rolls, { actor, token });
  }

  return rolls.map((roll, index) => ({
    index,
    total: roll.total,
    roll,
  }));
}

/**
 * @param {{ total: number }[]} rolls
 * @returns {string}
 */
export function buildRollStatsChatContent(rolls) {
  const cells = rolls.map(
    (entry, index) =>
      `<td class="roll-stats-chat-value roll-stats-chat-value--${
        index % 2 === 0 ? "a" : "b"
      }">${foundry.utils.escapeHTML(String(entry.total))}</td>`,
  );
  const rows = [];
  for (let i = 0; i < cells.length; i += 3) {
    rows.push(`<tr>${cells.slice(i, i + 3).join("")}</tr>`);
  }
  return `<table class="roll-stats-chat-table"><tbody>${rows.join(
    "",
  )}</tbody></table>`;
}

/**
 * @returns {Record<string, number>}
 */
export function getDefaultPointBuyValues() {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, STAT_MIN]));
}
