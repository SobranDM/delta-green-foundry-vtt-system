import DG from "../../config/index.js";
import { syncExhaustionEffect } from "./exhaustion-effect.js";
import { buildActiveEffectChangesUpdate } from "../active-effect-changes.js";

/**
 * @param {Actor} actor
 * @returns {ActiveEffect[]}
 */
function getStimulantEffects(actor) {
  return (
    actor.effects?.filter((effect) => effect.getFlag(DG.ID, "stimulant")) ?? []
  );
}

/**
 * @param {Actor} actor
 * @returns {ActiveEffect|undefined}
 */
function getStimulantEffect(actor) {
  return getStimulantEffects(actor).find((effect) => !effect.isSuppressed);
}

/**
 * @param {Actor} actor
 * @returns {boolean}
 */
export function hasActiveStimulantEffect(actor) {
  return getStimulantEffects(actor).some((effect) => !effect.isSuppressed);
}

/**
 * @param {ActiveEffect} effect
 * @returns {number}
 */
function getStimulantRemainingHours(effect) {
  effect.updateDuration();
  const { remaining, secondsRemaining, units } = effect.duration ?? {};
  if (Number.isFinite(remaining) && remaining > 0 && units === "hours") {
    return Math.ceil(remaining);
  }
  if (Number.isFinite(secondsRemaining) && secondsRemaining > 0) {
    const { calendar } = game.time;
    const components = calendar.difference(
      game.time.worldTime + secondsRemaining,
      game.time.worldTime,
    );
    const hours = calendar.componentsToUnit(components, "hour", {
      roundFn: "ceil",
    });
    return Math.max(0, Math.ceil(Math.abs(hours)));
  }
  return 0;
}

export { default as getEffectiveSuppressExhaustion } from "./agent-condition-sync.js";

/**
 * @param {number} hours
 * @returns {object}
 */
function buildStimulantEffectData(hours) {
  return {
    name: game.i18n.localize("DG.Physical.StimulantsEffectName"),
    img: "systems/deltagreen/assets/icons/tablet.svg",
    transfer: false,
    disabled: false,
    start: { time: game.time.worldTime },
    duration: {
      value: hours,
      units: "hours",
    },
    changes: [],
    flags: { [DG.ID]: { stimulant: true } },
  };
}

/**
 * Create or refresh the stimulant AE; duration is max(remaining, newHours).
 * @param {Actor} actor
 * @param {number} newHours
 * @returns {Promise<number>} Hours applied on the stimulant AE.
 */
export async function applyStimulantEffect(actor, newHours) {
  if (actor.type !== "agent") return 0;

  const rolledHours = Math.max(1, Math.ceil(Number(newHours) || 0));
  const existing = getStimulantEffect(actor);
  const remainingHours = existing ? getStimulantRemainingHours(existing) : 0;
  const hours = Math.max(remainingHours, rolledHours);

  const data = buildStimulantEffectData(hours);

  if (existing) {
    await existing.update({
      start: data.start,
      duration: data.duration,
      ...buildActiveEffectChangesUpdate(data.changes),
      disabled: false,
    });
    return hours;
  }

  const documentClass = foundry.utils.getDocumentClass("ActiveEffect");
  await documentClass.create(data, { parent: actor });
  return hours;
}

/**
 * @param {ActiveEffect} effect
 * @returns {boolean}
 */
function isStimulantEffectDurationElapsed(effect) {
  effect.updateDuration();
  const duration = effect.duration;
  if (!duration) return false;
  if (duration.expired) return true;
  if (
    Number.isFinite(duration.secondsRemaining) &&
    duration.secondsRemaining <= 0
  ) {
    return true;
  }
  return Number.isFinite(duration.remaining) && duration.remaining <= 0;
}

/**
 * Whether a stimulant AE can be deleted without racing Foundry's registry expiry batch.
 * When duration is elapsed, the registry removes the effect and asynchronously sets
 * `duration.expired` via modifyBatch — deleting before that update completes errors.
 * @param {ActiveEffect} effect
 * @returns {boolean}
 */
function canDeleteExpiredStimulantNow(effect) {
  effect.updateDuration();
  if (effect.duration?.expired) return true;
  if (!isStimulantEffectDurationElapsed(effect)) return false;
  const registry = foundry.documents.ActiveEffect.registry;
  return registry.has(effect);
}

/**
 * @param {Actor} actor
 * @returns {ActiveEffect[]}
 */
function getExpiredStimulantEffects(actor) {
  return getStimulantEffects(actor).filter(canDeleteExpiredStimulantNow);
}

/**
 * Wait for Foundry to mark elapsed stimulant AEs with duration.expired.
 * @param {Actor} actor
 * @param {object} [options]
 * @param {number} [options.timeoutMs=2000]
 * @returns {Promise<void>}
 */
async function waitForStimulantExpiryFlags(actor, { timeoutMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    actor.reset();
    const stimulants = getStimulantEffects(actor);
    if (!stimulants.length) return;
    const elapsed = stimulants.filter(isStimulantEffectDurationElapsed);
    if (!elapsed.length) return;
    if (elapsed.every((effect) => effect.duration?.expired)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Remove stimulant AEs that have expired.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function pruneExpiredStimulantEffects(actor) {
  if (actor.type !== "agent") return;

  let expired = getExpiredStimulantEffects(actor);
  if (!expired.length) {
    const pending = getStimulantEffects(actor).filter(
      (effect) =>
        isStimulantEffectDurationElapsed(effect) &&
        !canDeleteExpiredStimulantNow(effect),
    );
    if (pending.length) {
      await waitForStimulantExpiryFlags(actor);
      actor.reset();
      expired = getExpiredStimulantEffects(actor);
    }
  }

  if (!expired.length) return;

  const ids = expired
    .map((effect) => effect.id)
    .filter((id) => actor.effects.has(id));
  if (!ids.length) return;

  try {
    await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  } catch (err) {
    const message = String(err?.message ?? err);
    if (!message.includes("does not exist")) throw err;
  }
}

/**
 * Delete all stimulant AEs on the actor (e.g. after a full rest).
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function clearStimulantEffects(actor) {
  if (actor.type !== "agent") return;
  const effects = getStimulantEffects(actor);
  if (!effects.length) return;
  await actor.deleteEmbeddedDocuments(
    "ActiveEffect",
    effects.map((effect) => effect.id),
  );
}

/**
 * @returns {Promise<void>}
 */
export async function pruneAllAgentsExpiredStimulants() {
  if (!game.user.isActiveGM) return;
  for (const actor of game.actors) {
    if (actor.type === "agent") {
      await pruneExpiredStimulantEffects(actor);
      await syncExhaustionEffect(actor);
    }
  }
}
