import DG from "../config/index.js";
import enrichHTML from "../utils/enrich-html.js";
import { getDefaultRollMessageMode } from "../utils/message-mode.js";
import { hasWeaponDamage, hasWeaponLethality } from "./weapon-roll-fields.js";

/** @typedef {"ritualActivation"|"ritualLearn"} InventoryAutomationType */

export const INVENTORY_AUTOMATION_KEYS = /** @type {const} */ ({
  ritualActivation: "automateInventoryRitualActivation",
  ritualLearn: "automateInventoryRitualLearn",
});

/**
 * @param {InventoryAutomationType} type
 * @returns {boolean}
 */
export function isInventoryAutomationEnabled(type) {
  const key = INVENTORY_AUTOMATION_KEYS[type];
  if (!key) return true;
  return game.settings.get(DG.ID, key) ?? true;
}

/**
 * @param {Item} item
 * @param {{ shiftKey?: boolean, isGM?: boolean }} [options]
 * @returns {string}
 */
export function buildInventoryDisplayName(
  item,
  { isGM = game.user.isGM } = {},
) {
  if (
    (item.type === "tome" || item.type === "ritual") &&
    !item.system.revealed
  ) {
    if (isGM) return `${item.name}`;
    return "???";
  }
  return item.name;
}

/**
 * Roll-label line for inventory chat cards (may include HTML).
 * @param {Item} item
 * @returns {string}
 */
export function buildInventoryChatRollLabel(item) {
  const name = buildInventoryDisplayName(item);
  if (item.type === "bond") {
    const label = game.i18n.localize("TYPES.Item.bond");
    return `<b>${label}:</b> ${name}`;
  }
  return name;
}

/**
 * @param {Item} item
 * @returns {string}
 */
export function getPlayerVisibleDescription(item) {
  return item.system?.description ?? "";
}

/**
 * @param {Array<{ labelKey: string, value: string }>} headerLines
 * @returns {string}
 */
export function buildInventoryChatHeaderHtml(headerLines) {
  if (!headerLines?.length) return "";
  const rows = headerLines
    .filter((line) => line.value)
    .map(
      (line) =>
        `<div class="inventory-chat-header-row"><span class="inventory-chat-header-label">${game.i18n.localize(
          line.labelKey,
        )}</span> <span class="inventory-chat-header-value">${
          line.value
        }</span></div>`,
    )
    .join("");
  return rows ? `<div class="inventory-chat-header">${rows}</div>` : "";
}

/**
 * @param {Item} item
 * @returns {Promise<Array<{ labelKey: string, value: string }>>}
 */
export async function buildInventorySummaryHeader(item) {
  const { system } = item;
  const { isGM } = game.user;
  const masked =
    (item.type === "tome" || item.type === "ritual") &&
    !system.revealed &&
    !isGM;

  switch (item.type) {
    case "weapon":
      return [
        {
          labelKey: "DG.Gear.DamageOrLethality",
          value: hasWeaponDamage(system.damage)
            ? String(system.damage).toUpperCase()
            : hasWeaponLethality(system.lethality)
            ? `${system.lethality}%`
            : "",
        },
        {
          labelKey: "DG.Gear.ArmorPiercing",
          value: system.armorPiercing ? String(system.armorPiercing) : "",
        },
        {
          labelKey: "DG.ItemWindow.Weapons.Skill",
          value: system.skill
            ? game.i18n.localize(`DG.Skills.${system.skill}`)
            : "",
        },
        {
          labelKey: "DG.ItemWindow.Weapons.Range",
          value: system.range ?? "",
        },
      ].filter((row) => row.value);
    case "armor":
      return [
        {
          labelKey: "DG.Gear.ArmorRating",
          value: system.protection != null ? String(system.protection) : "",
        },
        {
          labelKey: "DG.ItemWindow.Armor.Expense",
          value: system.expense ?? "",
        },
      ].filter((row) => row.value);
    case "gear":
      return [
        {
          labelKey: "DG.ItemWindow.Gear.Expense",
          value: system.expense ?? "",
        },
        {
          labelKey: "DG.Gear.Equipped",
          value: system.equipped ? "✓" : "✗",
        },
      ];
    case "tome":
      return masked
        ? []
        : [
            {
              labelKey: "DG.Tome.Language",
              value: system.language ?? "",
            },
            {
              labelKey: "DG.Tome.StudyTime",
              value: system.studyTime ?? "",
            },
          ].filter((row) => row.value);
    case "ritual":
      return masked
        ? []
        : [
            {
              labelKey: "DG.ItemWindow.Ritual.StudyTime",
              value: system.studyTime ?? "",
            },
            {
              labelKey: "DG.ItemWindow.Ritual.ActivationTime",
              value: system.activationTime ?? "",
            },
            {
              labelKey: "DG.ItemWindow.Ritual.ActivationCosts",
              value: system.activationCosts ?? "",
            },
          ].filter((row) => row.value);
    case "bond":
      return [
        {
          labelKey: "DG.Bonds.Relationship",
          value: system.relationship ?? "",
        },
        {
          labelKey: "DG.Bonds.Score",
          value: system.score != null ? String(system.score) : "",
        },
      ].filter((row) => row.value);
    default:
      return [];
  }
}

/**
 * @param {Item} item
 * @returns {Promise<string>}
 */
export async function buildHandlerNotesChatHtml(item) {
  const notes =
    item.system?.handlerNotes?.trim?.() ?? item.system?.handlerNotes;
  if (!notes || (item.type !== "tome" && item.type !== "ritual")) return "";

  const enriched = await enrichHTML(notes, {
    async: true,
    relativeTo: item,
    secrets: true,
  });

  const header = game.i18n.localize("DG.Inventory.HandlerNotesGM");
  return `<div class="inventory-chat-handler-notes"><h4 class="inventory-chat-gm-header inventory-chat-handler-notes-header">${header}</h4><div class="inventory-chat-handler-notes-body">${enriched}</div></div>`;
}

/**
 * @param {Item} item
 * @param {boolean} activationSuccess
 * @returns {string}
 */
export function selectRitualActivationSanFormula(item, activationSuccess) {
  const { sanity } = item.system;
  return activationSuccess ? sanity.successLoss : sanity.failedLoss;
}

/**
 * @param {Roll} studyRoll
 * @param {Item} item
 * @returns {{ didLearn: boolean, sanFormula: string, publicMessageKey?: string }}
 */
export function resolveRitualStudyOutcome(studyRoll, item) {
  const { learnedSanity } = item.system;
  // DG convention: succeeding the SAN roll means the agent failed to learn the ritual.
  if (studyRoll.isSuccess) {
    return {
      didLearn: false,
      sanFormula: learnedSanity?.successLoss ?? "",
      publicMessageKey: "DG.Inventory.RitualLearnFailed",
    };
  }
  return {
    didLearn: true,
    sanFormula: learnedSanity?.failedLoss ?? "",
  };
}

/**
 * @param {Actor} actor
 * @param {Item} item
 * @returns {string}
 */
export function formatRitualLearnSuccessMessage(actor, item) {
  const ritualName = buildInventoryDisplayName(item);
  const increase = Number(item.system.unnaturalSkillIncrease) || 0;
  const formatData = { name: actor.name, ritualName };
  if (increase > 0) {
    return game.i18n.format("DG.Inventory.RitualLearnSucceededWithUnnatural", {
      ...formatData,
      increase,
    });
  }
  return game.i18n.format("DG.Inventory.RitualLearnSucceeded", formatData);
}

/**
 * Chat visibility for the ritual study roll card posted when a GM allows study.
 * @param {boolean} showToPlayers Value of the showRitualStudyRollsToPlayers setting
 * @returns {string}
 */
export function resolveRitualStudyRollMessageMode(showToPlayers) {
  return showToPlayers ? getDefaultRollMessageMode() : "blind";
}

/**
 * @param {object} params
 * @param {Actor} params.actor
 * @param {Item} params.item
 * @returns {Promise<void>}
 */
export async function applyRitualLearnRewards({ actor, item }) {
  await item.update({ "system.learned": true });

  const updates = {};
  const increase = Number(item.system.unnaturalSkillIncrease) || 0;
  if (increase > 0) {
    const path = "system.skills.unnatural.proficiency";
    const current = foundry.utils.getProperty(actor, path) ?? 0;
    updates[path] = Math.min(99, current + increase);
  }

  if (Object.keys(updates).length) {
    await actor.update(updates);
  }
}

/**
 * @param {Item} item
 * @param {{ shiftKey?: boolean }} [options]
 * @returns {string}
 */
export function resolveInventoryIconAction(item, { shiftKey = false } = {}) {
  switch (item.type) {
    case "weapon":
      return "weapon-attack";
    case "armor":
    case "gear":
    case "bond":
      return "chat-card";
    case "tome":
      if (shiftKey) return "tome-study-san";
      return "tome-choice";
    case "ritual":
      if (shiftKey) {
        return item.system.learned ? "ritual-perform" : "ritual-learn";
      }
      if (!item.system.learned) {
        return "ritual-learn";
      }
      return "ritual-choice";
    default:
      return "chat-card";
  }
}

export {
  hasWeaponDamage,
  hasWeaponLethality,
  hasWeaponDamageAndLethality,
} from "./weapon-roll-fields.js";
