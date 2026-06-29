import {
  createDGChatMessage,
  markDGChatCardForScrollNudge,
} from "./dg-chat-card.js";
import DG from "../config/index.js";
import enrichHTML from "../utils/enrich-html.js";
import { getDefaultRollMessageMode } from "../utils/message-mode.js";
import {
  buildInventoryChatHeaderHtml,
  buildInventoryChatRollLabel,
} from "../item/inventory-actions.js";

/**
 * @param {Item} item
 * @returns {Promise<string>}
 */
export async function enrichInventoryDescription(item) {
  const value = item.system?.description ?? "";
  if (!value) return "";
  return enrichHTML(value, {
    async: true,
    relativeTo: item,
  });
}

/**
 * @param {object} params
 * @param {Actor} params.actor
 * @param {TokenDocument|null} [params.token]
 * @param {string} [params.rollLabel]
 * @param {Array<{ labelKey: string, value: string }>|string} [params.headerLines]
 * @param {string} [params.headerHtml]
 * @param {string[]} [params.rollHtmlSections]
 * @param {string} [params.descriptionHtml]
 * @param {Item|null} [params.item]
 * @param {string} [params.extraHtml]
 * @param {string} [params.messageMode]
 * @param {object} [params.flags]
 * @returns {Promise<ChatMessage>}
 */
export async function postInventoryChatCard({
  actor,
  token = null,
  rollLabel = "",
  headerLines = [],
  headerHtml = "",
  rollHtmlSections = [],
  descriptionHtml = "",
  item = null,
  extraHtml = "",
  messageMode = getDefaultRollMessageMode(),
  flags = {},
}) {
  const header =
    headerHtml ||
    buildInventoryChatHeaderHtml(Array.isArray(headerLines) ? headerLines : []);
  const rolls = rollHtmlSections.filter(Boolean).join("");
  const description = descriptionHtml
    ? `<div class="inventory-chat-description">${descriptionHtml}</div>`
    : "";

  const content = [header, rolls, description, extraHtml]
    .filter(Boolean)
    .join("");

  const systemFlags = { ...(flags[DG.ID] ?? {}) };
  if (item) {
    systemFlags.inventoryItemId = item.id;
    systemFlags.inventoryActorId = actor.id;
  }

  return createDGChatMessage({
    actor,
    token,
    rollLabel: item ? buildInventoryChatRollLabel(item) : rollLabel,
    content,
    messageMode,
    flags: foundry.utils.mergeObject(flags, {
      [DG.ID]: systemFlags,
    }),
  });
}

/**
 * @param {object} params
 * @param {Actor} params.actor
 * @param {Item} params.item
 * @param {TokenDocument|null} [params.token]
 * @param {Array<{ labelKey: string, value: string }>} [params.headerLines]
 * @param {boolean} [params.includeAllowStudy]
 * @returns {Promise<ChatMessage>}
 */
export async function postRitualLearnRequestCard({
  actor,
  item,
  token = null,
  headerLines = [],
  includeAllowStudy = true,
}) {
  const descriptionHtml = await enrichInventoryDescription(item);

  const message = await postInventoryChatCard({
    actor,
    token,
    headerLines,
    descriptionHtml,
    item,
    flags: {
      [DG.ID]: {
        ritualLearnRequest: true,
        ritualStudyPending: includeAllowStudy,
        inventoryItemId: item.id,
        inventoryActorId: actor.id,
      },
    },
  });
  markDGChatCardForScrollNudge(message?.id);
  return message;
}
