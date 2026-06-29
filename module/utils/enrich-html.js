/**
 * Enrich HTML content by replacing or augmenting components of it.
 * Centralizes roll data and secret visibility defaults for document-relative content.
 * @param {string} content
 * @param {object} [options]
 * @returns {Promise<string>}
 */
export default async function enrichHTML(content, options = {}) {
  const resolved = { ...options };

  if (resolved.relativeTo) {
    // Don't reveal secrets of unowned documents, but allow explicit true/false overrides.
    if (resolved.secrets === undefined) {
      resolved.secrets = resolved.relativeTo.isOwner;
    }
    if (
      resolved.rollData === undefined &&
      typeof resolved.relativeTo.getRollData === "function"
    ) {
      resolved.rollData = resolved.relativeTo.getRollData();
    }
  }

  return foundry.applications.ux.TextEditor.implementation.enrichHTML(
    content,
    resolved,
  );
}
