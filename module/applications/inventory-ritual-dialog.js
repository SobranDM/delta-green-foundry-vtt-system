import { showDgDialog } from "./dg-dialog.js";
import { buildInventoryDisplayName } from "../item/inventory-actions.js";

/* eslint-disable import/prefer-default-export */

/**
 * @param {object} params
 * @param {Item} params.item
 * @param {boolean} [params.canPerform]
 * @returns {Promise<"description"|"perform"|null>}
 */
export async function showInventoryRitualDialog({ item, canPerform = true }) {
  const displayName = buildInventoryDisplayName(item);

  const buttons = [
    {
      action: "description",
      label: game.i18n.localize("DG.Inventory.SendDescriptionToChat"),
      callback: () => "description",
    },
  ];

  if (canPerform) {
    buttons.push({
      action: "perform",
      label: game.i18n.localize("DG.Inventory.PerformRitual"),
      callback: () => "perform",
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
