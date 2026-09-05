(() => {
  "use strict";

  // Firefox uses `browser`, Chrome uses `chrome` — same promise-based API here.
  const browser = globalThis.browser ?? globalThis.chrome;

  const STORAGE_KEY = "openfrontNukeToolsSettings";
  const UI_KEY = "openfrontPlusUi";
  const DEFAULT_SETTINGS = Object.freeze({
    samCoverage: true,
    nukeGrouper: true,
    teammateMarkers: true,
    incomingNukeAlert: true,
    globalNukeActivity: true,
    personalNukeTracker: true,
    enemyNukeReadiness: false,
    intelDiplomacy: true,
    intelReadinessPct: true,
    intelTargets: true,
    tradeIncome: true,
    tradeCaptures: false,
    tradeTransports: false,
    tradeWarships: false,
    overlayTroopRate: true,
    overlayGoldIncome: true,
    buildProgress: true,
    goldPerSecond: true,
    goldPerMinute: true,
    troopPerSecond: false,
    troopPerMinute: false,
  });
  const SETTING_IDS = Object.keys(DEFAULT_SETTINGS);
  const status = document.getElementById("status");
  let savedMessageTimer = null;
  // Ids the user explicitly flipped — once present, the storage value is
  // respected and the artifact-rescue in normalizeSettings no longer applies.
  const touchedIds = new Set();
  function markTouched(...ids) {
    for (const id of ids) touchedIds.add(id);
  }

  /* Collapsible groups: master switch reflects "any sub on", flipping the
   * master flips all subs. Masters NOT in SETTING_IDS are derived-only. */
  const GROUP_DEFS = [
    { name: "airspace", master: "globalNukeActivity", subs: ["personalNukeTracker"], lockSubsWhenOff: true },
    { name: "tradePartner", master: "tradePartner", subs: ["tradeIncome", "tradeCaptures", "tradeTransports", "tradeWarships"] },
    { name: "playerIntel", master: "playerIntel", subs: ["intelDiplomacy", "intelReadinessPct", "intelTargets"] },
    { name: "playerStats", master: "playerStatsOverlay", subs: ["overlayTroopRate", "overlayGoldIncome"] },
    { name: "goldIncome", master: "goldIncome", subs: ["goldPerSecond", "goldPerMinute"] },
    { name: "troopRate", master: "troopRate", subs: ["troopPerSecond", "troopPerMinute"] },
  ];

  /* Sections for grouping + per-section on-counts. */
  const SECTIONS = {
    nukes: ["samCoverage", "nukeGrouper", "incomingNukeAlert", "globalNukeActivity", "personalNukeTracker", "enemyNukeReadiness"],
    economy: ["tradeIncome", "tradeCaptures", "tradeTransports", "tradeWarships", "overlayTroopRate", "overlayGoldIncome", "goldPerSecond", "goldPerMinute", "troopPerSecond", "troopPerMinute", "intelDiplomacy", "intelReadinessPct", "intelTargets"],
    map: ["teammateMarkers", "buildProgress"],
  };

  /* Persisted UI state (which groups/sections are expanded). Defaults open. */
  let uiState = { groups: {}, sections: {} };
  function saveUiState() {
    try {
      browser.storage.local.set({ [UI_KEY]: uiState });
    } catch (_) {}
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    // Missing keys fall back to defaults. Additionally, a default-ON key that
    // reads as false WITHOUT a user-touch marker is treated as an artifact of
    // the pre-migration normalizer bug and rescued once; after the user
    // toggles anything themselves the __touched marker makes it permanent.
    const out = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      let v = source[key] === undefined
        ? Boolean(DEFAULT_SETTINGS[key])
        : Boolean(source[key]);
      if (
        source[key] === false &&
        source[key + "__touched"] !== true &&
        DEFAULT_SETTINGS[key] === true
      ) {
        v = Boolean(DEFAULT_SETTINGS[key]);
      }
      out[key] = v;
    }
    return out;
  }

  function readForm() {
    const out = {};
    for (const id of SETTING_IDS) {
      const input = document.getElementById(id);
      out[id] = input ? input.checked : false;
      if (touchedIds.has(id)) out[id + "__touched"] = true;
    }
    return out;
  }

  function writeForm(settings) {
    for (const id of SETTING_IDS) {
      const input = document.getElementById(id);
      if (input) {
        input.checked = Boolean(settings[id]);
      }
    }
    refreshAll();
  }

  function getInput(id) {
    return document.getElementById(id);
  }

  /* ---------- groups ---------- */

  function setupGroup(def) {
    const root = document.querySelector(`[data-group="${def.name}"]`);
    if (!root) return;
    const master = getInput(def.master);
    const subs = def.subs.map(getInput).filter(Boolean);
    const expander = root.querySelector(".group-expander");
    const subsBox = root.querySelector(".sub-toggles");

    if (expander && subsBox) {
      expander.addEventListener("click", () => {
        const open = !subsBox.classList.contains("open");
        subsBox.classList.toggle("open", open);
        expander.classList.toggle("open", open);
        expander.setAttribute("aria-expanded", String(open));
        uiState.groups[def.name] = open;
        saveUiState();
      });
    }
    if (master) {
      master.addEventListener("change", () => {
        const on = master.checked;
        if (SETTING_IDS.includes(def.master)) markTouched(def.master);
        for (const s of subs) {
          s.checked = on;
          markTouched(s.id);
        }
        saveSettings();
        refreshAll();
      });
    }
  }

  function refreshGroup(def) {
    const master = getInput(def.master);
    if (!master) return;
    const subs = def.subs.map(getInput).filter(Boolean);
    if (!SETTING_IDS.includes(def.master)) {
      master.checked = subs.some((s) => s.checked);
    }
    if (def.lockSubsWhenOff) {
      const locked = !master.checked;
      for (const s of subs) {
        s.disabled = locked;
        s.title = locked ? "Enable Show Nukes in Airspace first" : "";
      }
    }
  }

  function refreshAll() {
    for (const def of GROUP_DEFS) refreshGroup(def);
    updateCounts();
  }

  function applyGroupOpenStates() {
    for (const def of GROUP_DEFS) {
      const root = document.querySelector(`[data-group="${def.name}"]`);
      if (!root) continue;
      const open = uiState.groups[def.name] !== false;
      const subsBox = root.querySelector(".sub-toggles");
      const expander = root.querySelector(".group-expander");
      if (subsBox) subsBox.classList.toggle("open", open);
      if (expander) {
        expander.classList.toggle("open", open);
        expander.setAttribute("aria-expanded", String(open));
      }
    }
  }

  /* ---------- sections ---------- */

  function setupSections() {
    document.querySelectorAll("[data-section]").forEach((sec) => {
      const btn = sec.querySelector(".section-header");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const open = !sec.classList.contains("open");
        sec.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
        uiState.sections[sec.dataset.section] = open;
        saveUiState();
      });
    });
  }

  function applySectionOpenStates() {
    document.querySelectorAll("[data-section]").forEach((sec) => {
      const open = uiState.sections[sec.dataset.section] !== false;
      sec.classList.toggle("open", open);
      sec.querySelector(".section-header")?.setAttribute("aria-expanded", String(open));
    });
  }

  function updateCounts() {
    let totalOn = 0;
    for (const [name, ids] of Object.entries(SECTIONS)) {
      const on = ids.filter((id) => getInput(id)?.checked).length;
      totalOn += on;
      const el = document.querySelector(`[data-section-count="${name}"]`);
      if (el) el.textContent = `${on}/${ids.length}`;
    }
    const countEl = document.getElementById("enabledCount");
    if (countEl) countEl.textContent = `${totalOn} of ${SETTING_IDS.length} on`;
  }

  /* ---------- persistence ---------- */

  async function saveSettings() {
    try {
      await browser.storage.local.set({
        [STORAGE_KEY]: readForm(),
      });
      showSaved();
    } catch (_error) {
      status.textContent = "Could not save settings.";
      status.classList.add("error");
    }
  }

  function showSaved() {
    window.clearTimeout(savedMessageTimer);
    status.textContent = "Saved successfully.";
    status.classList.remove("error");
    status.classList.add("saved");
    savedMessageTimer = window.setTimeout(() => {
      status.textContent = "Settings are stored locally. You won't need to redo them.";
      status.classList.remove("saved");
    }, 1100);
  }

  function setAll(on) {
    for (const id of SETTING_IDS) {
      const input = getInput(id);
      if (input) {
        input.checked = on;
        markTouched(id);
      }
    }
    saveSettings();
    refreshAll();
  }

  /* ---------- diagnostics ---------- */

  function renderBridgeInfo() {
    browser.storage.local
      .get({ openfrontPlusBoots: [], openfrontPlusEvents: [] })
      .then((stored) => {
        const events = Array.isArray(stored.openfrontPlusEvents) ? stored.openfrontPlusEvents : [];
        const boots = Array.isArray(stored.openfrontPlusBoots) ? stored.openfrontPlusBoots : [];
        const body = document.getElementById("diagBody");
        if (!body) return;
        body.replaceChildren();
        const line = document.createElement("div");
        if (boots.length > 0) {
          const last = boots[boots.length - 1];
          line.textContent =
            `Bridge build: ${last.version} · booted ${new Date(last.ts).toLocaleTimeString()} · ${last.host ?? "?"}`;
        } else {
          line.textContent = "Bridge: no boot recorded yet.";
        }
        body.appendChild(line);
        const ev = events.length > 0 ? events[events.length - 1] : null;
        const evLine = document.createElement("div");
        evLine.textContent = ev
          ? `Content script ran: ${new Date(ev.ts).toLocaleTimeString()} · ${ev.host} · ${ev.href}`
          : "Content script: never ran (no event).";
        body.appendChild(evLine);
      })
      .catch(() => {});
  }

  /* ---------- wiring ---------- */

  for (const def of GROUP_DEFS) setupGroup(def);
  setupSections();

  document.getElementById("enableAll")?.addEventListener("click", () => setAll(true));
  document.getElementById("disableAll")?.addEventListener("click", () => setAll(false));

  // Reset to defaults needs a confirm step (no confirm() dialogs in popups —
  // they can close the popup). First click arms, second click resets.
  const resetBtn = document.getElementById("resetDefaults");
  let resetArmed = false;
  let resetArmTimer = null;
  function disarmReset() {
    resetArmed = false;
    if (resetBtn) {
      resetBtn.textContent = "Reset";
      resetBtn.classList.remove("armed");
    }
    window.clearTimeout(resetArmTimer);
  }
  resetBtn?.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = "Sure?";
      resetBtn.classList.add("armed");
      resetArmTimer = window.setTimeout(disarmReset, 3000);
      return;
    }
    disarmReset();
    touchedIds.clear();
    const fresh = normalizeSettings({ ...DEFAULT_SETTINGS });
    writeForm(fresh);
    browser.storage.local.set({ [STORAGE_KEY]: fresh })
      .then(() => {
        status.textContent = "Settings reset to defaults.";
        status.classList.remove("error");
        status.classList.add("saved");
        window.clearTimeout(savedMessageTimer);
        savedMessageTimer = window.setTimeout(() => {
          status.textContent = "Settings are stored locally. You won't need to redo them.";
          status.classList.remove("saved");
        }, 1100);
      })
      .catch(() => {
        status.textContent = "Could not reset settings.";
        status.classList.add("error");
      });
  });

  // Every real setting saves + refreshes; fake masters are handled by setupGroup.
  for (const id of SETTING_IDS) {
    const input = getInput(id);
    if (!input) continue;
    input.addEventListener("change", () => {
      markTouched(id);
      saveSettings();
      refreshAll();
    });
  }

  // Init: settings first, then UI collapse state (independent reads).
  browser.storage.local
    .get(STORAGE_KEY)
    .then((stored) => {
      writeForm(normalizeSettings(stored[STORAGE_KEY]));
    })
    .catch(() => {
      writeForm(DEFAULT_SETTINGS);
      status.textContent = "Could not load settings.";
    });

  browser.storage.local
    .get(UI_KEY)
    .then((stored) => {
      const v = stored?.[UI_KEY];
      if (v && typeof v === "object") {
        uiState = {
          groups: { ...(v.groups || {}) },
          sections: { ...(v.sections || {}) },
        };
      }
      applyGroupOpenStates();
      applySectionOpenStates();
    })
    .catch(() => {});

  renderBridgeInfo();
})();
