import DG from "../config/index.js";
import enrichHTML from "./enrich-html.js";

/**
 * Build GM migration notice content listing ritual items grouped by actor.
 * @returns {Promise<string>}
 */
export async function buildRitualMigrationNoticeContent() {
  const agents = game.actors
    .filter((a) => a.type === "agent")
    .sort((a, b) => a.name.localeCompare(b.name));
  const npcs = game.actors
    .filter((a) => a.type === "npc")
    .sort((a, b) => a.name.localeCompare(b.name));

  const sections = [];

  for (const actor of [...agents, ...npcs]) {
    const rituals = actor.items
      .filter((i) => i.type === "ritual")
      .sort((a, b) => a.name.localeCompare(b.name));
    if (rituals.length) {
      const ritualItems = rituals
        .map((item) => `<li>${item.link}</li>`)
        .join("");
      sections.push(
        `<li>${foundry.utils.escapeHTML(actor.name)}<ul>${ritualItems}</ul></li>`,
      );
    }
  }

  if (!sections.length) {
    return `<p>${game.i18n.localize("DG.Inventory.RitualMigrationNoRituals")}</p>`;
  }

  const html = `<ul class="inventory-ritual-migration-list">${sections.join("")}</ul>`;
  return enrichHTML(html, {
    async: true,
    documents: true,
  });
}

/**
 * Post one-time GM notice about ritual learned checkbox.
 * @returns {Promise<void>}
 */
export async function postRitualLearnedMigrationNotice() {
  const { createDGChatMessage } = await import("../chat/dg-chat-card.js");

  const title = game.i18n.localize("DG.Inventory.RitualMigrationTitle");
  const speaker = game.i18n.localize("DG.Inventory.RitualMigrationSpeaker");
  const intro = game.i18n.localize("DG.Inventory.RitualMigrationBodyIntro");
  const followUp = game.i18n.localize(
    "DG.Inventory.RitualMigrationBodyFollowUp",
  );
  const list = await buildRitualMigrationNoticeContent();

  await createDGChatMessage({
    actor: null,
    rollLabel: title,
    speakerAlias: speaker,
    content: `<p>${intro}</p><p>${followUp}</p>${list}`,
    messageMode: "gm",
    flags: {
      [DG.ID]: {
        ritualMigrationNotice: true,
      },
    },
  });
}
