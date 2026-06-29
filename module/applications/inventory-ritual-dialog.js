import { showDgDialog } from "./dg-dialog.js";
import { buildInventoryDisplayName } from "../item/inventory-actions.js";

/* eslint-disable import/prefer-default-export */

/**
 * @param {object} params
 * @param {Item} params.item
 * @param {boolean} params.learned
 * @param {boolean} [params.canPerformOrLearn]
 * @returns {Promise<"description"|"perform"|"learn"|null>}
 */
export async function showInventoryRitualDialog({
  item,
  learned,
  canPerformOrLearn = true,
}) {
  const displayName = buildInventoryDisplayName(item);
  const actionLabel = learned
    ? game.i18n.localize("DG.Inventory.PerformRitual")
    : game.i18n.localize("DG.Inventory.LearnRitual");

  const buttons = [
    {
      action: "description",
      label: game.i18n.localize("DG.Inventory.SendDescriptionToChat"),
      callback: () => "description",
    },
  ];

  if (canPerformOrLearn) {
    buttons.push({
      action: learned ? "perform" : "learn",
      label: actionLabel,
      callback: () => (learned ? "perform" : "learn"),
    });
  }

  return showDgDialog({
    window: {
      title: game.i18n.localize("DG.Inventory.RitualDialogTitle"),
    },
    content: `<p>${game.i18n.format("DG.Inventory.RitualDialogPrompt", { name: displayName })}</p>`,
    buttons,
    modifier: "inventory-ritual",
  });
}
