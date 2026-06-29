import DG from "../config/index.js";
import markForDeletion from "./forced-deletion.js";
import { compareSystemVersions, isAtLeastVersion } from "./system-version.js";
import { postRitualLearnedMigrationNotice } from "./ritual-migration-notice.js";

const MIGRATION_VERSION = 2;
/** Worlds below this version get the ritual learned checkbox notice on first 2.x load. */
const RITUAL_LEARNED_NOTICE_MIN_VERSION = "1.9.0";
const ACTOR_TYPES_WITH_SKILLS = ["agent", "npc", "unnatural"];
const OBSOLETE_WORLD_SETTINGS = [
  "characterSheetFont",
  "characterSheetBackgroundImageSetting",
];

/**
 * @returns {void}
 */
function removeObsoleteWorldSettings() {
  const worldConfig = game.settings.storage.get("world")?.document?.config;
  const dgConfig = worldConfig?.[DG.ID];
  if (!dgConfig) return;

  for (const key of OBSOLETE_WORLD_SETTINGS) {
    delete dgConfig[key];
  }
}

/**
 * @returns {Promise<void>}
 */
async function runSchemaMigration() {
  const currentVersion =
    game.settings.get(DG.ID, "schemaMigrationVersion") ?? 0;
  if (currentVersion >= MIGRATION_VERSION) return;

  let migratedActors = 0;

  const actors = game.actors.filter((actor) =>
    ACTOR_TYPES_WITH_SKILLS.includes(actor.type),
  );

  for (const actor of actors) {
    if (actor.system.skills?.ritual) {
      const skillsUpdate = {};
      markForDeletion(skillsUpdate, "ritual");
      await actor.update({
        system: {
          skills: skillsUpdate,
          schemaVersion: MIGRATION_VERSION,
        },
      });
      migratedActors += 1;
    }
  }

  removeObsoleteWorldSettings();

  await game.settings.set(DG.ID, "schemaMigrationVersion", MIGRATION_VERSION);

  console.log(
    `Delta Green | World migration v${MIGRATION_VERSION} complete. Removed legacy ritual skill from ${migratedActors} actor(s).`,
  );
}

/**
 * @returns {Promise<void>}
 */
async function runVersionMigrationNotice() {
  if (game.settings.get(DG.ID, "ritualLearnedMigrationNoticePosted")) return;

  const lastLoaded = game.settings.get(DG.ID, "lastLoadedSystemVersion") ?? "";
  const current = game.system.version ?? "";

  if (
    !isAtLeastVersion(lastLoaded, RITUAL_LEARNED_NOTICE_MIN_VERSION) &&
    isAtLeastVersion(current, RITUAL_LEARNED_NOTICE_MIN_VERSION)
  ) {
    await game.settings.set(DG.ID, "ritualLearnedMigrationNoticePosted", true);
    await postRitualLearnedMigrationNotice();
  }
}

/**
 * @returns {Promise<void>}
 */
async function updateLastLoadedSystemVersion() {
  const lastLoaded = game.settings.get(DG.ID, "lastLoadedSystemVersion") ?? "";
  const current = game.system.version ?? "";

  if (compareSystemVersions(current, lastLoaded) > 0) {
    await game.settings.set(DG.ID, "lastLoadedSystemVersion", current);
  }
}

/**
 * Run one-time world migrations for the Delta Green system.
 *
 * @returns {Promise<void>}
 */
export default async function runWorldMigration() {
  if (!game.user.isGM) return;

  await runSchemaMigration();
  await runVersionMigrationNotice();
  await updateLastLoadedSystemVersion();
}
