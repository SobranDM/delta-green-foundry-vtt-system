import DG from "../../config/index.js";
import { createDGChatMessage } from "../../chat/dg-chat-card.js";
import { getDefaultRollMessageMode } from "../../utils/message-mode.js";

const ADAPTATION_SOURCES = ["violence", "helplessness"];

/**
 * @param {object} changes
 * @returns {boolean}
 */
export function hasSanityValueChange(changes) {
  if (Object.keys(changes).some((key) => key === "system.sanity.value")) {
    return true;
  }
  return foundry.utils.getProperty(changes, "system.sanity.value") != null;
}

/**
 * @param {object} changes
 * @returns {boolean}
 */
export function hasAdaptationChange(changes) {
  if (
    Object.keys(changes).some((key) =>
      key.startsWith("system.sanity.adaptations."),
    )
  ) {
    return true;
  }
  return (
    foundry.utils.getProperty(changes, "system.sanity.adaptations") != null
  );
}

/**
 * @param {Actor} actor
 * @param {string} messageKey
 * @param {object} [formatData]
 * @returns {Promise<ChatMessage|void>}
 */
async function notifySanityChat(actor, messageKey, formatData = {}) {
  const content = game.i18n.format(messageKey, {
    name: actor.name,
    ...formatData,
  });
  return createDGChatMessage({
    actor,
    content,
    messageMode: getDefaultRollMessageMode(),
  });
}

/**
 * @param {{ incident1?: boolean, incident2?: boolean }} adaptation
 * @returns {"incident1"|"incident2"|"incident3"}
 */
function getNextAdaptationIncident(adaptation) {
  if (!adaptation.incident1) return "incident1";
  if (!adaptation.incident2) return "incident2";
  return "incident3";
}

/**
 * @param {Actor} actor
 * @param {string[]} sources
 * @returns {Promise<void>}
 */
async function clearAdaptationCheckboxesForSourcesIfNotAdapted(actor, sources) {
  if (!game.settings.get(DG.ID, "automateAdaptationTicks")) return;
  if (!game.actors.get(actor.id)) return;
  const { adaptations } = actor.system.sanity ?? {};
  if (!adaptations) return;
  const updateData = {};
  for (const source of sources) {
    const adaptation = adaptations[source];
    if (adaptation && !adaptation.isAdapted) {
      updateData[`system.sanity.adaptations.${source}.incident1`] = false;
      updateData[`system.sanity.adaptations.${source}.incident2`] = false;
      updateData[`system.sanity.adaptations.${source}.incident3`] = false;
    }
  }
  if (Object.keys(updateData).length) await actor.update(updateData);
}

/**
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
async function tickAdaptationForLastSanitySourceIfNotAdapted(actor) {
  if (!game.settings.get(DG.ID, "automateAdaptationTicks")) return;
  if (!game.actors.get(actor.id)) return;

  const lastSource = actor.getFlag(DG.ID, "lastSanityRollSource");
  if (lastSource !== "violence" && lastSource !== "helplessness") return;

  const { adaptations } = actor.system.sanity ?? {};
  if (!adaptations) return;

  const adaptation =
    lastSource === "violence" ? adaptations.violence : adaptations.helplessness;

  if (!adaptation || adaptation.isAdapted) return;

  const nextIncident = getNextAdaptationIncident(adaptation);
  await actor.update({
    [`system.sanity.adaptations.${lastSource}.${nextIncident}`]: true,
  });
}

/**
 * @param {Actor} actor
 * @param {object} changed
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function reactToAdaptationChange(actor, changed, options) {
  const adaptationBefore = options.dg?.previousAdaptations;
  if (!adaptationBefore) return;
  if (!game.actors.get(actor.id)) return;

  const { adaptations } = actor.system.sanity ?? {};
  if (!adaptations) return;

  const nowViolence = adaptations.violence?.isAdapted ?? false;
  const nowHelplessness = adaptations.helplessness?.isAdapted ?? false;
  if (!adaptationBefore.violence && nowViolence) {
    await notifySanityChat(actor, "DG.Messages.AdaptedToSanity", {
      adaptationType: game.i18n.localize("DG.Mental.AdaptedToViolence"),
    });
  }
  if (!adaptationBefore.helplessness && nowHelplessness) {
    await notifySanityChat(actor, "DG.Messages.AdaptedToSanity", {
      adaptationType: game.i18n.localize("DG.Mental.AdaptedToHelplessness"),
    });
  }
}

/**
 * @param {Actor} actor
 * @param {object} changed
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function reactToSanityLoss(actor, changed, options) {
  const sanityBefore = options.dg?.previousSanity;
  if (!sanityBefore || actor.system.sanity?.value == null) return;
  if (!game.actors.get(actor.id)) return;

  const { value: valueBefore, aboveBreakingPoint } =
    typeof sanityBefore === "number"
      ? { value: sanityBefore, aboveBreakingPoint: true }
      : sanityBefore;
  const valueNow = actor.system.sanity.value;
  const drop = valueBefore - valueNow;
  const { currentBreakingPoint } = actor.system.sanity;
  const hitBreakingPoint =
    aboveBreakingPoint &&
    typeof currentBreakingPoint === "number" &&
    valueNow <= currentBreakingPoint;

  // Nested incident-only updates do not change SAN value, so _preUpdate does not
  // snapshot again and this path does not re-run on tick/clear passes.
  if (drop >= 5) {
    if (!hitBreakingPoint) {
      const lastSource = actor.getFlag(DG.ID, "lastSanityRollSource");
      if (lastSource === "violence" || lastSource === "helplessness") {
        await clearAdaptationCheckboxesForSourcesIfNotAdapted(actor, [
          lastSource,
        ]);
      }
    }
    await notifySanityChat(actor, "DG.Messages.BecameTemporaryInsane");
  }
  if (hitBreakingPoint) {
    await clearAdaptationCheckboxesForSourcesIfNotAdapted(
      actor,
      ADAPTATION_SOURCES,
    );
    await notifySanityChat(actor, "DG.Messages.HitBreakingPoint");
  }
  if (drop > 0 && drop < 5 && !hitBreakingPoint) {
    await tickAdaptationForLastSanitySourceIfNotAdapted(actor);
  }

  if (drop > 0) {
    if (!game.actors.get(actor.id)) return;
    await actor.setFlag(DG.ID, "lastSanityRollSource", "none");
  }
}
