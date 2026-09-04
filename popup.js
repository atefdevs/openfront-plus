(() => {
  "use strict";

  // Firefox uses `browser`, Chrome uses `chrome` — same promise-based API here.
  const browser = globalThis.browser ?? globalThis.chrome;

  const STORAGE_KEY = "openfrontNukeToolsSettings";
  const DEFAULT_SETTINGS = Object.freeze({
    samCoverage: true,
    nukeGrouper: true,
    teammateMarkers: true,
    incomingNukeAlert: true,
    globalNukeActivity: true,
    personalNukeTracker: true,
    enemyNukeReadiness: false,
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
    updateDependencies();
  }

  /* toggle dependency handling */

  function updateDependencies() {
    updateAirspaceState();
    updateTradePartnerState();
    updatePlayerStatsState();
    updateGoldIncomeState();
    updateTroopRateState();
  }

  function updatePlayerStatsState() {
    const mainToggle = document.getElementById("playerStatsOverlay");
    if (!mainToggle) return;
    mainToggle.checked =
      (document.getElementById("overlayTroopRate")?.checked || false) ||
      (document.getElementById("overlayGoldIncome")?.checked || false);
  }

  function updateTradePartnerState() {
    const mainToggle = document.getElementById("tradePartner");
    if (!mainToggle) return;
    mainToggle.checked =
      (document.getElementById("tradeIncome")?.checked || false) ||
      (document.getElementById("tradeCaptures")?.checked || false) ||
      (document.getElementById("tradeTransports")?.checked || false) ||
      (document.getElementById("tradeWarships")?.checked || false);
  }

  function updateAirspaceState() {
    const globalInput = document.getElementById("globalNukeActivity");
    const personalInput = document.getElementById("personalNukeTracker");
    const lockIcon = document.getElementById("lockIcon");
    if (!globalInput || !personalInput) return;

    if (!globalInput.checked) {
      personalInput.disabled = true;
      personalInput.checked = false;
      markTouched("personalNukeTracker");
      if (lockIcon) lockIcon.style.display = "";
    } else {
      personalInput.disabled = false;
      if (lockIcon) lockIcon.style.display = "none";
    }
  }

  function toggleAirspaceSubs() {
    const subs = document.getElementById("airspaceSubs");
    const arrow = document.getElementById("airspaceArrow");
    if (!subs || !arrow) return;
    const isOpen = subs.classList.toggle("open");
    arrow.classList.toggle("open", isOpen);
    arrow.textContent = isOpen ? "▼" : "▶";
  }

  function updateGoldIncomeState() {
    const perSecond = document.getElementById("goldPerSecond");
    const perMinute = document.getElementById("goldPerMinute");
    const mainToggle = document.getElementById("goldIncome");
    if (!perSecond || !perMinute || !mainToggle) return;
    mainToggle.checked = perSecond.checked || perMinute.checked;
    mainToggle.disabled = false;
  }

  function updateTroopRateState() {
    const perSecond = document.getElementById("troopPerSecond");
    const perMinute = document.getElementById("troopPerMinute");
    const mainToggle = document.getElementById("troopRate");
    if (!perSecond || !perMinute || !mainToggle) return;
    mainToggle.checked = perSecond.checked || perMinute.checked;
    mainToggle.disabled = false;
  }

  function toggleGoldIncomeSubs() {
    const subs = document.getElementById("goldIncomeSubs");
    const arrow = document.getElementById("goldIncomeArrow");
    if (!subs || !arrow) return;
    const isOpen = subs.classList.toggle("open");
    arrow.classList.toggle("open", isOpen);
    arrow.textContent = isOpen ? "▼" : "▶";
  }

  function goldIncomeMainClicked() {
    const mainToggle = document.getElementById("goldIncome");
    const perSecond = document.getElementById("goldPerSecond");
    const perMinute = document.getElementById("goldPerMinute");
    if (!mainToggle || !perSecond || !perMinute) return;
    const newState = mainToggle.checked;
    perSecond.checked = newState;
    perMinute.checked = newState;
    markTouched("goldPerSecond", "goldPerMinute");
    saveSettings();
    updateGoldIncomeState();
  }

  function toggleTroopRateSubs() {
    const subs = document.getElementById("troopRateSubs");
    const arrow = document.getElementById("troopRateArrow");
    if (!subs || !arrow) return;
    const isOpen = subs.classList.toggle("open");
    arrow.classList.toggle("open", isOpen);
    arrow.textContent = isOpen ? "▼" : "▶";
  }

  function troopRateMainClicked() {
    const mainToggle = document.getElementById("troopRate");
    const perSecond = document.getElementById("troopPerSecond");
    const perMinute = document.getElementById("troopPerMinute");
    if (!mainToggle || !perSecond || !perMinute) return;
    const newState = mainToggle.checked;
    perSecond.checked = newState;
    perMinute.checked = newState;
    markTouched("troopPerSecond", "troopPerMinute");
    saveSettings();
    updateTroopRateState();
  }

  function toggleTradePartnerSubs() {
    const subs = document.getElementById("tradePartnerSubs");
    const arrow = document.getElementById("tradePartnerArrow");
    if (!subs || !arrow) return;
    const isOpen = subs.classList.toggle("open");
    arrow.classList.toggle("open", isOpen);
    arrow.textContent = isOpen ? "▼" : "▶";
  }

  function tradePartnerMainClicked() {
    const mainToggle = document.getElementById("tradePartner");
    const subs = [
      "tradeIncome",
      "tradeCaptures",
      "tradeTransports",
      "tradeWarships",
    ];
    if (!mainToggle) return;
    const newState = mainToggle.checked;
    for (const id of subs) {
      const input = document.getElementById(id);
      if (input) input.checked = newState;
    }
    markTouched(...subs);
    saveSettings();
    updateTradePartnerState();
  }

  function togglePlayerStatsSubs() {
    const subs = document.getElementById("playerStatsSubs");
    const arrow = document.getElementById("playerStatsArrow");
    if (!subs || !arrow) return;
    const isOpen = subs.classList.toggle("open");
    arrow.classList.toggle("open", isOpen);
    arrow.textContent = isOpen ? "▼" : "▶";
  }

  function playerStatsMainClicked() {
    const mainToggle = document.getElementById("playerStatsOverlay");
    const subs = ["overlayTroopRate", "overlayGoldIncome"];
    if (!mainToggle) return;
    const newState = mainToggle.checked;
    for (const id of subs) {
      const input = document.getElementById(id);
      if (input) input.checked = newState;
    }
    markTouched(...subs);
    saveSettings();
    updatePlayerStatsState();
  }

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

  function showDisabledMessage() {
    window.clearTimeout(savedMessageTimer);
    status.textContent = "Cannot enable 'Show Your Nukes' without 'Show Nukes in Airspace' enabled.";
    status.classList.remove("saved");
    status.classList.add("error");
    savedMessageTimer = window.setTimeout(() => {
      status.textContent = "Settings are stored locally. You won't need to redo them.";
      status.classList.remove("error");
    }, 2500);
  }

  // Attach change listeners
  for (const id of SETTING_IDS) {
    const input = document.getElementById(id);
    if (!input) continue;

    // Record explicit user intent before any handler saves.
    input.addEventListener("change", () => { markTouched(id); });

    if (id === "goldPerSecond" || id === "goldPerMinute") {
      input.addEventListener("change", () => {
        saveSettings();
        updateGoldIncomeState();
      });
    } else if (id === "troopPerSecond" || id === "troopPerMinute") {
      input.addEventListener("change", () => {
        saveSettings();
        updateTroopRateState();
      });
    } else if (id === "tradeIncome" || id === "tradeCaptures" ||
               id === "tradeTransports" || id === "tradeWarships") {
      input.addEventListener("change", () => {
        saveSettings();
        updateTradePartnerState();
      });
    } else if (id === "overlayTroopRate" || id === "overlayGoldIncome") {
      input.addEventListener("change", () => {
        saveSettings();
        updatePlayerStatsState();
      });
    } else if (id === "globalNukeActivity") {
      input.addEventListener("change", () => {
        updateDependencies();
        saveSettings();
      });
    } else {
      input.addEventListener("change", saveSettings);
    }
  }

  // Collapse/expand
  const goldIncomeArrowBtn = document.getElementById("goldIncomeArrow");
  if (goldIncomeArrowBtn) {
    goldIncomeArrowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleGoldIncomeSubs();
    });
  }

  // Main gold toggle
  const goldIncomeToggle = document.getElementById("goldIncome");
  if (goldIncomeToggle) {
    goldIncomeToggle.addEventListener("change", goldIncomeMainClicked);
  }

  // Troop rate collapse/expand
  const troopRateArrowBtn = document.getElementById("troopRateArrow");
  if (troopRateArrowBtn) {
    troopRateArrowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleTroopRateSubs();
    });
  }

  // Main troop toggle
  const troopRateToggle = document.getElementById("troopRate");
  if (troopRateToggle) {
    troopRateToggle.addEventListener("change", troopRateMainClicked);
  }

  // Trade partner collapse/expand
  const tradePartnerArrowBtn = document.getElementById("tradePartnerArrow");
  if (tradePartnerArrowBtn) {
    tradePartnerArrowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleTradePartnerSubs();
    });
  }

  // Main trade partner toggle
  const tradePartnerToggle = document.getElementById("tradePartner");
  if (tradePartnerToggle) {
    tradePartnerToggle.addEventListener("change", tradePartnerMainClicked);
  }

  // Player stats collapse/expand + main toggle
  const playerStatsArrowBtn = document.getElementById("playerStatsArrow");
  if (playerStatsArrowBtn) {
    playerStatsArrowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlayerStatsSubs();
    });
  }
  const playerStatsToggle = document.getElementById("playerStatsOverlay");
  if (playerStatsToggle) {
    playerStatsToggle.addEventListener("change", playerStatsMainClicked);
  }

  // Disabled personal tracker click
  const personalCard = document.getElementById("personalNukeTrackerCard");
  if (personalCard) {
    personalCard.addEventListener("click", (e) => {
      const personalInput = document.getElementById("personalNukeTracker");
      if (personalInput && personalInput.disabled) {
        e.preventDefault();
        showDisabledMessage();
      }
    });
  }

  // Airspace collapse/expand — button only, so checkbox works independently
  const airspaceArrowBtn = document.getElementById("airspaceArrow");
  if (airspaceArrowBtn) {
    airspaceArrowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAirspaceSubs();
    });
  }

  function renderBridgeInfo() {
    browser.storage.local
      .get({ openfrontPlusBoots: [], openfrontPlusEvents: [] })
      .then((stored) => {
        const events = Array.isArray(stored.openfrontPlusEvents) ? stored.openfrontPlusEvents : [];
        const boots = Array.isArray(stored.openfrontPlusBoots) ? stored.openfrontPlusBoots : [];
        const wrap = document.createElement("div");
        wrap.style.cssText = "margin-top:10px;font-size:10px;color:#94a3b8;line-height:1.6;";
        const line = document.createElement("div");
        if (boots.length > 0) {
          const last = boots[boots.length - 1];
          line.textContent =
            `Bridge build: ${last.version} · booted ${new Date(last.ts).toLocaleTimeString()} · ${last.host ?? "?"}`;
        } else {
          line.textContent = "Bridge: no boot recorded yet.";
        }
        wrap.appendChild(line);
        const ev = events.length > 0 ? events[events.length - 1] : null;
        if (ev) {
          const evLine = document.createElement("div");
          evLine.textContent =
            `Content script ran: ${new Date(ev.ts).toLocaleTimeString()} · ${ev.host} · ${ev.href}`;
          wrap.appendChild(evLine);
        } else {
          const evLine = document.createElement("div");
          evLine.textContent = "Content script: never ran (no event).";
          wrap.appendChild(evLine);
        }
        (document.querySelector("main") ?? document.body).appendChild(wrap);
      })
      .catch(() => {});
  }

  // Init
  browser.storage.local
    .get(STORAGE_KEY)
    .then((stored) => {
      writeForm(normalizeSettings(stored[STORAGE_KEY]));
    })
    .catch(() => {
      writeForm(DEFAULT_SETTINGS);
      status.textContent = "Could not load settings.";
    });

  renderBridgeInfo();
})();