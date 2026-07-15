import DG from "../../config/index.js";
import HumanSkillsActorData from "./base/human-skills.js";
import CharacterData from "./base/character.js";
import DGHTMLField from "../fields/html-content-field.js";
import { agentResourceField } from "./base/general.js";
import {
  computeEquippedArmorProtection,
  initializeSanityIfUnset,
  prepareSanityAdaptations,
  prepareStatisticsX5,
  removeLegacyRitualSkill,
} from "../derived/actor-derived.js";
import {
  hasAdaptationChange,
  hasSanityValueChange,
  reactToAdaptationChange,
  reactToSanityLoss,
} from "../derived/sanity-automation.js";

const { SchemaField, NumberField, StringField, BooleanField } =
  foundry.data.fields;

export default class AgentData extends CharacterData {
  static defineSchema() {
    const superData = super.defineSchema();

    const { health: _health, wp: _wp, ...restSuper } = superData;

    return {
      ...restSuper,
      health: agentResourceField(10, 10),
      wp: agentResourceField(10, 10),
      ...HumanSkillsActorData.defineSchema(),
      schemaVersion: new NumberField({ initial: 2.0 }),
      sanity: new SchemaField({
        value: new NumberField({ initial: 100, min: 0, integer: true }),
        max: new NumberField({ initial: 99, min: 0, integer: true }),
        currentBreakingPoint: new NumberField({ initial: 101, integer: true }),
        maxBonus: new NumberField({ initial: 0, integer: true }),
        adaptations: new SchemaField({
          violence: new SchemaField({
            incident1: new BooleanField({ initial: false }),
            incident2: new BooleanField({ initial: false }),
            incident3: new BooleanField({ initial: false }),
          }),
          helplessness: new SchemaField({
            incident1: new BooleanField({ initial: false }),
            incident2: new BooleanField({ initial: false }),
            incident3: new BooleanField({ initial: false }),
          }),
        }),
      }),
      rollTarget: new SchemaField({
        allSkills: new NumberField({ initial: 0, integer: true }),
        sanity: new NumberField({ initial: 0, integer: true }),
        statistics: new NumberField({ initial: 0, integer: true }),
      }),
      physical: new SchemaField({
        description: DGHTMLField(),
        wounds: new StringField({ initial: "" }),
        firstAidAttempted: new BooleanField({ initial: false }),
        exhausted: new BooleanField({ initial: false }),
        exhaustedPenalty: new NumberField({ initial: -20 }),
        suppressExhaustion: new BooleanField({ initial: false }),
        stimulantDosesSinceRest: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
        }),
      }),
      biography: new SchemaField({
        profession: new StringField({ initial: "" }),
        employer: new StringField({ initial: "" }),
        nationality: new StringField({ initial: "" }),
        sex: new StringField({ initial: "" }),
        age: new StringField({ initial: "" }),
        education: new StringField({ initial: "" }),
      }),
      corruption: new SchemaField({
        value: new NumberField({ initial: 0 }),
        haveSeenTheYellowSign: new BooleanField({ initial: false }),
        gift: new StringField({ initial: "" }),
        insight: new StringField({ initial: "" }),
      }),
    };
  }

  /** @inheritdoc */
  prepareBaseData() {
    // rollTarget is modified by add-type Active Effects each prepare cycle.
    this.rollTarget.allSkills = 0;
    this.rollTarget.sanity = 0;
    this.rollTarget.statistics = 0;
  }

  /** @inheritdoc */
  prepareDerivedData() {
    // Pre–final-AE setup only. Post-AE derived fields (max, x5 refresh,
    // breaking point, etc.) are applied in DeltaGreenActor.prepareData via
    // refreshDerivedAfterActiveEffects after the final Active Effect phase.
    prepareStatisticsX5(
      this.statistics,
      this.parent?._source?.system?.statistics,
    );
    removeLegacyRitualSkill(this);
    initializeSanityIfUnset(this.sanity, this.statistics);
    prepareSanityAdaptations(this.sanity.adaptations);

    this.health.protection = computeEquippedArmorProtection(this.parent.items);

    if (this.physical.exhaustedPenalty > 0) {
      this.physical.exhaustedPenalty =
        -1 * Math.abs(this.physical.exhaustedPenalty);
    }
  }

  /** @inheritdoc */
  async _preUpdate(changes, options, user) {
    await super._preUpdate(changes, options, user);
    if (!game.settings.get(DG.ID, "automateAdaptationTicks")) return;

    options.dg ??= {};

    if (hasSanityValueChange(changes)) {
      options.dg.previousSanity = {
        value: this.sanity.value,
        aboveBreakingPoint:
          this.sanity.value > this.sanity.currentBreakingPoint,
      };
      options.dg.lastSanityRollSource = this.parent.getFlag(
        DG.ID,
        "lastSanityRollSource",
      );
    }

    if (hasAdaptationChange(changes)) {
      options.dg.previousAdaptations = {
        violence: this.sanity.adaptations.violence?.isAdapted ?? false,
        helplessness: this.sanity.adaptations.helplessness?.isAdapted ?? false,
      };
    }
  }

  /** @inheritdoc */
  async _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (!game.settings.get(DG.ID, "automateAdaptationTicks")) return;
    if (userId !== game.user.id) return;

    const actor = this.parent;
    if (options.dg?.previousAdaptations) {
      await reactToAdaptationChange(actor, changed, options);
    }
    if (options.dg?.previousSanity) {
      await reactToSanityLoss(actor, changed, options);
    }
  }
}
