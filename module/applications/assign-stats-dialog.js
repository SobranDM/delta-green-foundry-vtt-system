import { BASE_TEMPLATE_PATH } from "../config/index.js";
import {
  STAT_MAX,
  STAT_MIN,
  applyAgentStatistics,
  buildPointBuyValidationMessages,
  buildStatisticRows,
  computePointsRemaining,
  getDefaultPointBuyValues,
  getPointBuyInvalidKeys,
  validatePointBuyValues,
} from "../profession/stat-setup.js";
import { getDialogContentRoot, showDgDialog } from "./dg-dialog.js";

const { renderTemplate } = foundry.applications.handlebars;

/** @typedef {'submitted' | 'back'} AssignStatsOutcome */

/**
 * @param {DialogV2} dialog
 * @returns {Record<string, number>}
 */
function readPointBuyInputsFromDom(dialog) {
  /** @type {Record<string, number>} */
  const values = {};
  const root = getDialogContentRoot(dialog);
  if (!root) return values;

  for (const input of root.querySelectorAll("[data-stat-key]")) {
    const key = input.dataset.statKey;
    if (key) {
      const raw = input.value.trim();
      values[key] = raw === "" ? Number.NaN : Number(raw);
    }
  }
  return values;
}

/**
 * @param {DialogV2} dialog
 * @param {object} [options]
 * @param {boolean} [options.showErrors=false]
 */
function refreshAssignStatsUi(dialog, { showErrors = false } = {}) {
  const values = readPointBuyInputsFromDom(dialog);
  const remaining = computePointsRemaining(values);

  const root = getDialogContentRoot(dialog);
  const remainingEl = root?.querySelector("[data-points-remaining]");
  if (remainingEl) {
    remainingEl.textContent = game.i18n.format(
      "DG.ProfessionSetup.AssignStats.PointsRemaining",
      { remaining },
    );
    remainingEl.classList.toggle("is-invalid", remaining !== 0);
  }

  const messagesEl = root?.querySelector("[data-assign-stats-messages]");
  const statInputs = root?.querySelectorAll("[data-stat-key]") ?? [];

  if (showErrors) {
    const invalidKeys = new Set(getPointBuyInvalidKeys(values));
    for (const input of statInputs) {
      const key = input.dataset.statKey;
      if (key) input.setAttribute("aria-invalid", String(invalidKeys.has(key)));
    }
  } else {
    for (const input of statInputs) {
      input.removeAttribute("aria-invalid");
    }
  }

  if (messagesEl) {
    if (showErrors) {
      const messages = buildPointBuyValidationMessages(values);
      messagesEl.innerHTML = messages
        .map(
          (message) =>
            `<p class="dg-dialog__message--error">${foundry.utils.escapeHTML(
              message,
            )}</p>`,
        )
        .join("");
      messagesEl.hidden = messages.length === 0;
    } else {
      messagesEl.innerHTML = "";
      messagesEl.hidden = true;
    }
  }
}

/**
 * @param {DialogV2} dialog
 */
function bindAssignStatsListeners(dialog) {
  const root = getDialogContentRoot(dialog);
  if (!root) return;

  root.querySelectorAll("[data-stat-key]").forEach((input) => {
    input.addEventListener("input", () => refreshAssignStatsUi(dialog));
    input.addEventListener("change", () => refreshAssignStatsUi(dialog));
  });
}

/**
 * @param {Actor} actor
 * @returns {Promise<{ outcome: 'submitted' } | { outcome: 'back' } | null>}
 */
export default async function showAssignStatsDialog(actor) {
  /** @type {Record<string, number>} */
  const values = getDefaultPointBuyValues();
  const remaining = computePointsRemaining(values);
  /** @type {{ outcome: 'submitted' } | { outcome: 'back' } | null} */
  let result = null;

  const content = await renderTemplate(
    `${BASE_TEMPLATE_PATH}/dialog/assign-stats.html`,
    {
      stats: buildStatisticRows(),
      values,
      statMin: STAT_MIN,
      statMax: STAT_MAX,
      remaining,
    },
  );

  return showDgDialog({
    modifier: "assign-stats",
    content,
    window: {
      title: game.i18n.localize("DG.ProfessionSetup.AssignStats.Title"),
    },
    position: { width: 420 },
    form: { closeOnSubmit: false },
    onRender: (dialog) => {
      bindAssignStatsListeners(dialog);
      refreshAssignStatsUi(dialog);
    },
    close: () => result,
    buttons: [
      {
        action: "back",
        label: game.i18n.localize("DG.ProfessionSetup.GoBack"),
        callback: async (_event, _button, dialog) => {
          result = { outcome: "back" };
          await dialog.close();
        },
      },
      {
        action: "submit",
        label: game.i18n.localize("DG.ProfessionSetup.AssignStats.Submit"),
        default: true,
        callback: async (_event, _button, dialog) => {
          const submittedValues = readPointBuyInputsFromDom(dialog);
          const { isValid } = validatePointBuyValues(submittedValues);
          if (!isValid) {
            refreshAssignStatsUi(dialog, { showErrors: true });
            return false;
          }

          await applyAgentStatistics(actor, { ...submittedValues });
          result = { outcome: "submitted" };
          await dialog.close();
          return false;
        },
      },
    ],
  });
}
