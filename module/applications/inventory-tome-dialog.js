import { showDgDialog } from "./dg-dialog.js";
import { buildInventoryDisplayName } from "../item/inventory-actions.js";

/* eslint-disable import/prefer-default-export */

/**
 * @param {object} params
 * @param {Item} params.item
 * @returns {Promise<"description"|"study"|null>}
 */
export async function showInventoryTomeDialog({ item }) {
  const displayName = buildInventoryDisplayName(item);

  return showDgDialog({
    window: {
      title: game.i18n.localize("DG.Inventory.TomeDialogTitle"),
    },
    content: `<p>${game.i18n.format("DG.Inventory.TomeDialogPrompt", { name: displayName })}</p>`,
    buttons: [
      {
        action: "description",
        label: game.i18n.localize("DG.Inventory.SendDescriptionToChat"),
        callback: () => "description",
      },
      {
        action: "study",
        label: game.i18n.localize("DG.Inventory.StudyTome"),
        callback: () => "study",
      },
    ],
    modifier: "inventory-tome",
  });
}
