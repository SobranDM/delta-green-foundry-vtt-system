/** @internal Import roll subclasses only from ../roll.js. */
/* eslint-disable import/prefer-default-export */
import {
  createDGRollChatMessage,
  prepareDGRollChatMessageData,
} from "../../chat/dg-chat-card.js";
import { applyRollMessageModeToMessage } from "../../utils/message-mode.js";

export class DGRoll extends Roll {
  /**
   * @param {unknown} actor
   * @returns {DeltaGreenActor|null}
   */
  static _resolveActorReference(actor) {
    if (!actor) return null;
    if (actor.system) return actor;
    if (typeof actor === "string") return game.actors?.get(actor) ?? null;
    if (actor.id) return game.actors?.get(actor.id) ?? null;
    return null;
  }

  /**
   * @param {unknown} item
   * @returns {DeltaGreenItem|null}
   */
  static _resolveItemReference(item) {
    if (!item) return null;
    if (item.system) return item;
    if (typeof item === "string") return game.items?.get(item) ?? null;
    if (item.id) return game.items?.get(item.id) ?? null;
    return null;
  }

  /**
   * NOTE: This class will rarely be called on its own. It should generally be extended. Look to DGPercentileRoll as an example.
   *
   * Customize our roll with some useful information, passed in the `options` Object.
   *
   * @param {string}          formula            Unused - The string formula to parse (from Foundry)
   * @param {Object}          data               Unused - The data object against which to parse attributes within the formula
   * @param {Object}          [options]          Additional data which is preserved in the database
   * @param {Number}          [options.rollType] The type of roll (stat, skill, sanity, damage, etc).
   * @param {String}          [options.key]      The key of the skill, stat, etc. to use as a basis for this roll.
   * @param {DeltaGreenActor} [options.actor]    The actor that this roll originates from.
   * @param {DeltaGreenItem}  [options.item]     Optional - The item from which the roll originates.
   */
  constructor(formula, data = {}, options = {}) {
    super(formula, data, options);
    const { rollType, key, actor, item } = options;
    this.type = rollType;
    this.key = key;
    this.actor = DGRoll._resolveActorReference(actor);
    this.item = DGRoll._resolveItemReference(item);
    this.modifier = 0;
  }

  /** @override */
  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      key: this.key,
      modifier: this.modifier,
    };
  }

  /**
   * @override
   * @param {object} data
   * @returns {DGRoll}
   */
  static fromData(data) {
    const roll = super.fromData(data);
    roll.type = data.type ?? roll.type ?? roll.options?.rollType;
    roll.key = data.key ?? roll.key ?? roll.options?.key;
    roll.modifier = data.modifier ?? roll.modifier ?? 0;
    roll.actor =
      DGRoll._resolveActorReference(roll.options?.actor) ?? roll.actor ?? null;
    roll.item =
      DGRoll._resolveItemReference(roll.options?.item) ?? roll.item ?? null;
    return roll;
  }

  /**
   * Posts a roll to chat with the Delta Green card shell and an explicit `rolls`
   * array for Dice So Nice (listen-path compatible).
   *
   * @override
   * The following `@param` descriptions comes from the Foundry VTT code.
   * @param {object} messageData          The data object to use when creating the message
   * @param {options} [options]           Additional options which modify the created message.
   * @param {string} [options.messageMode]  A key of CONFIG.ChatMessage.modes
   * @param {boolean} [options.create=true]   Whether to automatically create the chat message, or only return the
   *                                          prepared chatData object.
   * @returns {Promise<ChatMessage|object>} A promise which resolves to the created ChatMessage document if create is
   *                                        true, or the Object of prepared chatData otherwise.
   */
  async toMessage(messageData = {}, { messageMode, create = true } = {}) {
    const { title, subtitle, rollLabel, label, flavor } = messageData;
    const resolvedLabel = label ?? flavor;
    delete messageData.title;
    delete messageData.subtitle;
    delete messageData.rollLabel;
    delete messageData.label;

    const mode =
      messageMode ?? this.options.messageMode ?? this.options.rollMode;

    const chatParams = {
      roll: this,
      actor: this.actor,
      token: this.options.token,
      title,
      subtitle,
      rollLabel,
      label: resolvedLabel,
      content: messageData.content,
      messageMode: mode,
      flags: messageData.flags ?? {},
    };

    if (create) {
      return createDGRollChatMessage(chatParams);
    }

    const { messageData: prepared, mappedMode } =
      await prepareDGRollChatMessageData(chatParams);

    const cls = foundry.utils.getDocumentClass("ChatMessage");
    // eslint-disable-next-line new-cap -- Foundry document class resolved at runtime
    const msg = new cls(prepared);
    applyRollMessageModeToMessage(msg, mappedMode);
    return msg.toObject();
  }
}
