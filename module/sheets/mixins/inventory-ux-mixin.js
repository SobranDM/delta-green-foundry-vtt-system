import { getDGRollToken } from "../../chat/dg-chat-card.js";
import { buildInventorySummaryHeader } from "../../item/inventory-actions.js";
import { createDGRollFromDataset } from "../../roll/roll.js";
import enrichHTML from "../../utils/enrich-html.js";

/** @param {typeof foundry.applications.api.ApplicationV2} Base */
export default function InventoryUxMixin(Base) {
  return class extends Base {
    /** @type {Set<string>} Item ids with an open inventory summary drawer (session-only). */
    _expandedInventoryItemIds = new Set();

    /** @override */
    async _onRender(context, options) {
      await super._onRender(context, options);
      await this._restoreExpandedInventorySummaries(this.element);
    }

    /** Drop stale ids (deleted items, etc.) from the session set. */
    _pruneExpandedInventoryItemIds() {
      for (const itemId of this._expandedInventoryItemIds) {
        if (!this.actor.items.has(itemId)) {
          this._expandedInventoryItemIds.delete(itemId);
        }
      }
    }

    /**
     * @param {string} itemId
     */
    _forgetExpandedInventoryItemSummary(itemId) {
      if (itemId) this._expandedInventoryItemIds.delete(itemId);
    }

    /**
     * @param {HTMLElement} entry
     * @param {Item} item
     */
    async _expandInventoryItemSummary(entry, item) {
      const headerLines = await buildInventorySummaryHeader(item);
      const headerHtml = headerLines
        .map(
          (line) =>
            `<dt class="resource-label">${game.i18n.localize(line.labelKey)}</dt><dd>${line.value}</dd>`,
        )
        .join("");
      const description = await enrichHTML(item.system.description ?? "", {
        async: true,
        relativeTo: item,
      });

      const summary = document.createElement("div");
      summary.className = "item-summary";
      summary.innerHTML = `${
        headerHtml
          ? `<dl class="inventory-summary-header">${headerHtml}</dl>`
          : ""
      }<div class="inventory-summary-description">${description}</div>`;
      entry.appendChild(summary);
      entry.classList.add("expanded");

      const caret = entry.querySelector(".inventory-item-caret i");
      if (caret) {
        caret.classList.remove("fa-caret-right");
        caret.classList.add("fa-caret-down");
      }
      entry
        .querySelector(".inventory-item-caret")
        ?.setAttribute("aria-expanded", "true");

      this._expandedInventoryItemIds.add(item.id);
    }

    /**
     * @param {HTMLElement} entry
     * @param {string} [itemId]
     */
    _collapseInventoryItemSummary(entry, itemId) {
      entry.classList.remove("expanded");
      entry.querySelector(".item-summary")?.remove();

      const caret = entry.querySelector(".inventory-item-caret i");
      if (caret) {
        caret.classList.remove("fa-caret-down");
        caret.classList.add("fa-caret-right");
      }
      entry
        .querySelector(".inventory-item-caret")
        ?.setAttribute("aria-expanded", "false");

      if (itemId) this._forgetExpandedInventoryItemSummary(itemId);
    }

    /**
     * Re-open drawers that were expanded before the last sheet render.
     * @param {HTMLElement|null|undefined} root
     */
    async _restoreExpandedInventorySummaries(root) {
      if (!root) return;

      this._pruneExpandedInventoryItemIds();
      if (!this._expandedInventoryItemIds.size) return;

      const restoreTasks = [];
      for (const entry of root.querySelectorAll(".item-entry")) {
        const itemId = entry.querySelector(".item[data-item-id]")?.dataset
          ?.itemId;
        if (
          itemId &&
          this._expandedInventoryItemIds.has(itemId) &&
          !entry.querySelector(".item-summary")
        ) {
          const item = this.actor.items.get(itemId);
          if (item) {
            restoreTasks.push(this._expandInventoryItemSummary(entry, item));
          } else {
            this._forgetExpandedInventoryItemSummary(itemId);
          }
        }
      }

      await Promise.all(restoreTasks);
    }

    /**
     * @param {Event} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    static async _onRollItemIcon(event, target) {
      event.preventDefault();
      event.stopPropagation();

      const row = target.closest(".item[data-item-id]");
      if (!row) return;

      const item = this.actor.items.get(row.dataset.itemId);
      if (!item) return;

      if ((event.shiftKey || event.which === 3) && item.type === "weapon") {
        const roll = createDGRollFromDataset(
          {
            rolltype: "weapon",
            key: item.system.skill,
            iid: item.id,
          },
          {
            actor: this.actor,
            item,
            token: getDGRollToken(this.actor, this.token),
          },
        );
        await this.processRoll(event, roll);
        return;
      }

      await item.rollFromInventory({
        actor: this.actor,
        token: this.token,
        event,
      });
    }

    /**
     * @param {Event} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    static async _onToggleItemSummary(event, target) {
      event.preventDefault();
      event.stopPropagation();

      const entry = target.closest(".item-entry");
      if (!entry) return;

      const itemId = entry.querySelector(".item[data-item-id]")?.dataset
        ?.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const existing = entry.querySelector(".item-summary");

      if (existing) {
        this._collapseInventoryItemSummary(entry, item.id);
        return;
      }

      await this._expandInventoryItemSummary(entry, item);
    }
  };
}
