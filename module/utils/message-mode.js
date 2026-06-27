/**
 * v14 uses `core.messageMode` and `ChatMessage.applyMode`; v13 uses `core.rollMode` and `applyRollMode`.
 * @returns {boolean}
 */
export function usesMessageModeApi() {
  return game.settings.settings.has("core.messageMode");
}

/**
 * @returns {string}
 */
export function getDefaultRollMessageMode() {
  if (usesMessageModeApi()) {
    return game.settings.get("core", "messageMode");
  }
  return game.settings.get("core", "rollMode");
}

/**
 * @param {string|undefined|null} mode
 * @returns {string}
 */
export function normalizeRollMessageMode(mode) {
  const resolved = mode ?? getDefaultRollMessageMode();

  if (typeof foundry.dice.Roll._mapLegacyRollMode === "function") {
    return foundry.dice.Roll._mapLegacyRollMode(resolved);
  }

  const toLegacy = {
    public: "publicroll",
    gm: "gmroll",
    blind: "blindroll",
    self: "selfroll",
  };
  return toLegacy[resolved] ?? resolved;
}

/**
 * @param {string|undefined|null} mode
 * @returns {boolean}
 */
export function isBlindRollMessageMode(mode) {
  const normalized = normalizeRollMessageMode(mode);
  return normalized === "blind" || normalized === "blindroll";
}

/**
 * @param {ChatMessage} message
 * @param {string|undefined|null} mode
 */
export function applyRollMessageModeToMessage(message, mode) {
  const normalized = normalizeRollMessageMode(mode);
  if (typeof message.applyMode === "function") {
    message.applyMode(normalized);
  } else {
    message.applyRollMode(normalized);
  }
}

/**
 * @param {object} [messageMode]
 * @returns {{ messageMode: string } | { rollMode: string }}
 */
export function buildChatMessageModeOptions(messageMode) {
  const normalized = normalizeRollMessageMode(messageMode);
  if (usesMessageModeApi()) {
    return { messageMode: normalized };
  }
  return { rollMode: normalized };
}

/**
 * @returns {Record<string, { label: string, icon?: string }>}
 */
export function getAvailableRollMessageModes() {
  if (usesMessageModeApi() && CONFIG.ChatMessage?.modes) {
    return Object.fromEntries(
      ["public", "gm", "blind", "self"]
        .filter((key) => key in CONFIG.ChatMessage.modes)
        .map((key) => [key, CONFIG.ChatMessage.modes[key]]),
    );
  }

  return CONFIG.Dice.rollModes ?? {};
}
