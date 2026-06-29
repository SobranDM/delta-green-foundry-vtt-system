/* eslint-disable import/prefer-default-export */

import DeltaGreenItem from "../item/item.js";

export async function handleInlineActions(btnWithAction, messageId) {
  const action = btnWithAction.dataset?.action;
  const message = game.messages.get(messageId);
  const actor = message?.speakerActor;
  if (!actor && action !== "ritual-allow-study") return;

  if (action === "rollback-skill-failure-state") {
    const rollbackFlag = message.getFlag("deltagreen", "rollbacks");
    await actor.update(foundry.utils.deepClone(rollbackFlag));

    // eslint-disable-next-line no-use-before-define
    toggleAllSkillFailures(rollbackFlag);

    const label = btnWithAction
      .closest(".rollback-section")
      ?.querySelector("label");
    const oldHtml = label.outerHTML;
    label.classList.toggle("strike");

    message.update({
      [`flags.deltagreen.rollbacks`]: rollbackFlag,
      content: message.content.replace(oldHtml, label.outerHTML),
    });
    return;
  }

  if (
    action === "inventory-roll-damage" ||
    action === "inventory-roll-lethality"
  ) {
    const { actorId, itemId, isCritical } = btnWithAction.dataset;
    const rollActor = game.actors.get(actorId) ?? actor;
    const item = rollActor?.items.get(itemId);
    if (!rollActor || !item || item.type !== "weapon") return;

    if (action === "inventory-roll-damage") {
      await item.rollWeaponDamage(isCritical === "true");
    } else {
      await item.rollWeaponLethality();
    }
    return;
  }

  if (action === "ritual-allow-study") {
    if (!game.user.isGM) return;

    const { actorId, itemId } = btnWithAction.dataset;
    const ritualActor = game.actors.get(actorId);
    const item = ritualActor?.items.get(itemId);
    if (!ritualActor || !item) return;

    btnWithAction.disabled = true;

    await DeltaGreenItem.allowRitualStudy({
      actor: ritualActor,
      item,
      messageId,
    });

    ui.chat?.element
      ?.querySelector(`[data-message-id="${messageId}"]`)
      ?.querySelector(".inventory-ritual-learn-footer")
      ?.remove();
  }
}

function toggleAllSkillFailures(data) {
  for (const skill of Object.values(data.system?.skills || {})) {
    skill.failure = !skill.failure;
  }
  for (const skill of Object.values(data.system?.typedSkills || {})) {
    skill.failure = !skill.failure;
  }
}
