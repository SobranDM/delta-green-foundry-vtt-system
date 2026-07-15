import DG from "../config/index.js";
import {
  getDGRollToken,
  getTokenFromChatSpeaker,
  markDGChatCardForScrollNudge,
} from "../chat/dg-chat-card.js";
import { getDefaultRollMessageMode } from "../utils/message-mode.js";
import {
  enrichInventoryDescription,
  postInventoryChatCard,
  postRitualLearnRequestCard,
} from "../chat/inventory-chat.js";
import {
  renderLabeledSanityLossRollHtml,
  renderPercentileRollHtml,
  renderSanityDamageRollHtml,
} from "../chat/inventory-roll-html.js";
import { showInventoryRitualDialog } from "../applications/inventory-ritual-dialog.js";
import { showInventoryTomeDialog } from "../applications/inventory-tome-dialog.js";
import {
  applyRitualLearnRewards,
  buildInventorySummaryHeader,
  formatRitualLearnSuccessMessage,
  isInventoryAutomationEnabled,
  resolveInventoryIconAction,
  resolveRitualStudyOutcome,
  resolveRitualStudyRollMessageMode,
  selectRitualActivationSanFormula,
} from "./inventory-actions.js";
import { resolvePrivateSanRollMessageMode } from "../utils/private-san-roll.js";
import appendMeleeDamageBonus from "../roll/melee-damage.js";
import {
  createDGRollFromDataset,
  DGDamageRoll,
  DGLethalityRoll,
  DGPercentileRoll,
} from "../roll/roll.js";

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export default class DeltaGreenItem extends Item {
  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll(isCrit = false) {
    const item = this;
    const { actor } = this;
    let roll;
    if (item.system.isLethal) {
      roll = new DGLethalityRoll(
        "1D100",
        {},
        {
          rollType: "lethality",
          actor,
          item,
          token: getDGRollToken(actor, actor.sheet?.token),
        },
      );
    } else {
      let diceFormula = appendMeleeDamageBonus(
        item.system.damage,
        actor,
        item.system.skill,
      );

      if (isCrit) {
        diceFormula = `2*(${diceFormula})`;
      }

      roll = new DGDamageRoll(
        diceFormula,
        {},
        {
          rollType: "damage",
          actor,
          item,
          token: getDGRollToken(actor, actor.sheet?.token),
        },
      );
    }
    return actor.sheet.processRoll({}, roll);
  }

  /**
   * Roll weapon damage from an inventory or chat follow-up action.
   * @param {boolean} [isCrit=false]
   * @returns {Promise<ChatMessage|void>}
   */
  async rollWeaponDamage(isCrit = false) {
    const { actor } = this;
    let diceFormula = appendMeleeDamageBonus(
      this.system.damage,
      actor,
      this.system.skill,
    );

    if (isCrit) {
      diceFormula = `2*(${diceFormula})`;
    }

    const roll = new DGDamageRoll(
      diceFormula,
      {},
      {
        rollType: "damage",
        actor,
        item: this,
        token: getDGRollToken(actor, actor.sheet?.token),
      },
    );
    return actor.sheet.processRoll({}, roll);
  }

  /**
   * Roll weapon lethality from an inventory or chat follow-up action.
   * @returns {Promise<ChatMessage|void>}
   */
  async rollWeaponLethality() {
    const { actor } = this;
    const roll = new DGLethalityRoll(
      "1D100",
      {},
      {
        rollType: "lethality",
        actor,
        item: this,
        token: getDGRollToken(actor, actor.sheet?.token),
      },
    );
    return actor.sheet.processRoll({}, roll);
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {TokenDocument|null} [params.token]
   * @param {Event|object} [params.event]
   * @returns {Promise<void>}
   */
  async rollFromInventory({ actor, token, event = {} }) {
    const action = resolveInventoryIconAction(this, {
      shiftKey: event.shiftKey,
    });
    const sheetToken = token ?? getDGRollToken(actor, actor.sheet?.token);

    switch (action) {
      case "weapon-attack": {
        const roll = createDGRollFromDataset(
          {
            rolltype: "weapon",
            key: this.system.skill,
            iid: this.id,
          },
          { actor, item: this, token: sheetToken },
        );
        return actor.sheet.processRoll(event, roll);
      }
      case "tome-study-san":
        return this.studyTome({ actor, token: sheetToken });
      case "tome-choice":
        return this._handleTomeInventoryClick({ actor, token: sheetToken });
      case "chat-card":
        return this.showInventoryCard({ actor, token: sheetToken });
      case "ritual-choice":
        return this._handleRitualInventoryClick({
          actor,
          token: sheetToken,
        });
      case "ritual-perform":
        return this.performRitual({ actor, token: sheetToken, event });
      case "ritual-learn":
        return this.learnRitual({ actor, token: sheetToken });
      default:
        return this.showInventoryCard({ actor, token: sheetToken });
    }
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {TokenDocument|null} [params.token]
   * @returns {Promise<ChatMessage>}
   */
  async showInventoryCard({ actor, token = null }) {
    const headerLines = await buildInventorySummaryHeader(this);
    const descriptionHtml = await enrichInventoryDescription(this);
    return postInventoryChatCard({
      actor,
      token,
      rollLabel: this.name,
      headerLines,
      descriptionHtml,
      item: this,
    });
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {TokenDocument|null} [params.token]
   * @returns {Promise<ChatMessage|void>}
   */
  async performRitual({ actor, token = null }) {
    if (!isInventoryAutomationEnabled("ritualActivation")) {
      ui.notifications.warn("DG.Inventory.RitualActivationDisabled", {
        localize: true,
      });
      return this.showInventoryCard({ actor, token });
    }

    const sheetToken = token ?? getDGRollToken(actor, actor.sheet?.token);
    const activationRoll = createDGRollFromDataset(
      { rolltype: "skill", key: "ritual" },
      { actor, item: this, token: sheetToken },
    );

    await activationRoll.evaluate();

    const sanFormula = selectRitualActivationSanFormula(
      this,
      activationRoll.isSuccess,
    );

    const headerLines = await buildInventorySummaryHeader(this);
    const descriptionHtml = await enrichInventoryDescription(this);
    const activationHtml = await renderPercentileRollHtml(activationRoll);
    const sanLossHtml = await renderLabeledSanityLossRollHtml(sanFormula);
    const messageMode = resolvePrivateSanRollMessageMode(
      activationRoll.options.messageMode,
      { rollType: activationRoll.type, key: activationRoll.key },
    );

    const message = await postInventoryChatCard({
      actor,
      token: sheetToken,
      rollLabel: this.name,
      headerLines,
      descriptionHtml,
      item: this,
      rollHtmlSections: [activationHtml, sanLossHtml],
      messageMode,
      flags: {
        [DG.ID]: {
          ritualPerform: true,
        },
      },
    });
    markDGChatCardForScrollNudge(message?.id);
    return message;
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {TokenDocument|null} [params.token]
   * @returns {Promise<ChatMessage>}
   */
  async learnRitual({ actor, token = null }) {
    const headerLines = await buildInventorySummaryHeader(this);
    const includeAllowStudy = isInventoryAutomationEnabled("ritualLearn");
    return postRitualLearnRequestCard({
      actor,
      item: this,
      token,
      headerLines,
      includeAllowStudy,
    });
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {Item} params.item
   * @param {string} params.messageId
   * @returns {Promise<void>}
   */
  static async allowRitualStudy({ actor, item, messageId }) {
    if (!game.user.isGM) return;
    if (!isInventoryAutomationEnabled("ritualLearn")) {
      ui.notifications.warn("DG.Inventory.RitualLearnDisabled", {
        localize: true,
      });
      return;
    }

    const message = game.messages.get(messageId);
    if (!message) return;
    if (message.getFlag(DG.ID, "ritualStudyResolved")) return;

    await message.update({
      [`flags.${DG.ID}.ritualStudyResolved`]: true,
    });

    const studyRoll = new DGPercentileRoll(
      "1D100",
      {},
      {
        rollType: "sanity",
        key: "sanity",
        actor,
        item,
        ignoreRollTargetModifiers: true,
      },
    );

    await studyRoll.evaluate();

    const showToPlayers = game.settings.get(
      DG.ID,
      "showRitualStudyRollsToPlayers",
    );
    const studyMessageMode = resolveRitualStudyRollMessageMode(showToPlayers);
    studyRoll.options.messageMode = studyMessageMode;
    studyRoll.options.token =
      getTokenFromChatSpeaker(message.speaker) ?? getDGRollToken(actor);

    const { rollLabel } = studyRoll.createChatHeader();
    const studyHtml = await renderPercentileRollHtml(studyRoll);

    const outcome = resolveRitualStudyOutcome(studyRoll, item);
    const publicMessage = outcome.didLearn
      ? formatRitualLearnSuccessMessage(actor, item)
      : game.i18n.localize(outcome.publicMessageKey);
    const outcomeHtml = `<p class="inventory-ritual-outcome">${publicMessage}</p>`;
    const rollSections = [];

    const sanLossHtml = await renderLabeledSanityLossRollHtml(
      outcome.sanFormula,
    );
    if (sanLossHtml) rollSections.push(sanLossHtml);

    if (outcome.didLearn) {
      await applyRitualLearnRewards({
        actor,
        item,
      });
    }

    const studyResultInner = (inner) =>
      inner ? `<div class="inventory-ritual-study-result">${inner}</div>` : "";
    const rollSectionsHtml = rollSections.join("");

    if (showToPlayers) {
      await studyRoll.toMessage(
        {
          content:
            studyHtml + studyResultInner(`${rollSectionsHtml}${outcomeHtml}`),
          rollLabel,
        },
        { messageMode: studyMessageMode },
      );
    } else {
      await studyRoll.toMessage(
        {
          content: studyHtml + studyResultInner(rollSectionsHtml),
          rollLabel,
        },
        { messageMode: studyMessageMode },
      );

      await postInventoryChatCard({
        actor,
        token: studyRoll.options.token,
        rollLabel: item.name,
        extraHtml: studyResultInner(outcomeHtml),
        messageMode: getDefaultRollMessageMode(),
        item,
      });
    }
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {TokenDocument|null} params.token
   * @param {Event|object} params.event
   * @returns {Promise<void>}
   */
  async _handleRitualInventoryClick({ actor, token }) {
    const canPerform = isInventoryAutomationEnabled("ritualActivation");

    const choice = await showInventoryRitualDialog({
      item: this,
      canPerform,
    });

    if (choice === "description") {
      await this.showInventoryCard({ actor, token });
    } else if (choice === "perform") {
      await this.performRitual({ actor, token });
    }
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {TokenDocument|null} params.token
   * @returns {Promise<void>}
   */
  async _handleTomeInventoryClick({ actor, token }) {
    const choice = await showInventoryTomeDialog({ item: this });

    if (choice === "description") {
      await this.showInventoryCard({ actor, token });
    } else if (choice === "study") {
      await this.studyTome({ actor, token });
    }
  }

  /**
   * @param {object} params
   * @param {Actor} params.actor
   * @param {TokenDocument|null} params.token
   * @returns {Promise<ChatMessage>}
   */
  async studyTome({ actor, token }) {
    const headerLines = await buildInventorySummaryHeader(this);
    const descriptionHtml = await enrichInventoryDescription(this);
    const sanRoll = createDGRollFromDataset(
      { rolltype: "sanity-damage" },
      {
        actor,
        item: this,
        sanityDamageSource: "item",
        token,
      },
    );
    await sanRoll.evaluate();
    const sanHtml = await renderSanityDamageRollHtml(sanRoll);

    return postInventoryChatCard({
      actor,
      token,
      rollLabel: this.name,
      headerLines,
      descriptionHtml,
      item: this,
      rollHtmlSections: [sanHtml],
    });
  }
}
