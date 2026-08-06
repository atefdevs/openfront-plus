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
    goldPerSecond: true,
    goldPerMinute: true,
    troopPerSecond: false,
    troopPerMinute: false,
  });
  const SETTING_IDS = Object.keys(DEFAULT_SETTINGS);
  const status = document.getElementById("status");
  let savedMessageTimer = null;

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      samCoverage: Boolean(source.samCoverage),
      nukeGrouper: Boolean(source.nukeGrouper),
      teammateMarkers: Boolean(source.teammateMarkers),
      incomingNukeAlert: Boolean(source.incomingNukeAlert),
      globalNukeActivity: Boolean(source.globalNukeActivity),
      personalNukeTracker: Boolean(source.personalNukeTracker),
      enemyNukeReadiness: Boolean(source.enemyNukeReadiness),
      tradeIncome: Boolean(source.tradeIncome),
      tradeCaptures: Boolean(source.tradeCaptures),
      tradeTransports: Boolean(source.tradeTransports),
      tradeWarships: Boolean(source.tradeWarships),
      goldPerSecond: Boolean(source.goldPerSecond),
      goldPerMinute: Boolean(source.goldPerMinute),
      troopPerSecond: Boolean(source.troopPerSecond),
      troopPerMinute: Boolean(source.troopPerMinute),
    };
  }

  function readForm() {
    const out = {};
    for (const id of SETTING_IDS) {
      const input = document.getElementById(id);
      out[id] = input ? input.checked : false;
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
    updateGoldIncomeState();
    updateTroopRateState();
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
    subs.classList.toggle("open");
    arrow.classList.toggle("open");
  }

  function airspaceMainClicked() {
    saveSettings();
    updateAirspaceState();
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
    subs.classList.toggle("open");
    arrow.classList.toggle("open");
  }

  function goldIncomeMainClicked() {
    const mainToggle = document.getElementById("goldIncome");
    const perSecond = document.getElementById("goldPerSecond");
    const perMinute = document.getElementById("goldPerMinute");
    if (!mainToggle || !perSecond || !perMinute) return;
    const newState = mainToggle.checked;
    perSecond.checked = newState;
    perMinute.checked = newState;
    saveSettings();
    updateGoldIncomeState();
  }

  function toggleTroopRateSubs() {
    const subs = document.getElementById("troopRateSubs");
    const arrow = document.getElementById("troopRateArrow");
    if (!subs || !arrow) return;
    subs.classList.toggle("open");
    arrow.classList.toggle("open");
  }

  function troopRateMainClicked() {
    const mainToggle = document.getElementById("troopRate");
    const perSecond = document.getElementById("troopPerSecond");
    const perMinute = document.getElementById("troopPerMinute");
    if (!mainToggle || !perSecond || !perMinute) return;
    const newState = mainToggle.checked;
    perSecond.checked = newState;
    perMinute.checked = newState;
    saveSettings();
    updateTroopRateState();
  }

  function toggleTradePartnerSubs() {
    const subs = document.getElementById("tradePartnerSubs");
    const arrow = document.getElementById("tradePartnerArrow");
    if (!subs || !arrow) return;
    subs.classList.toggle("open");
    arrow.classList.toggle("open");
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
    saveSettings();
    updateTradePartnerState();
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
    status.textContent = "Saved succesfully.";
    status.classList.remove("error");
    status.classList.add("saved");
    savedMessageTimer = window.setTimeout(() => {
      status.textContent = "Settings are stored locally. You wont need to redo them.";
      status.classList.remove("saved");
    }, 1100);
  }

  function showDisabledMessage() {
    window.clearTimeout(savedMessageTimer);
    status.textContent = "Cannot enable 'Show Your Nukes' without 'Show Nukes in Airspace' enabled.";
    status.classList.remove("saved");
    status.classList.add("error");
    savedMessageTimer = window.setTimeout(() => {
      status.textContent = "Settings are stored locally. You wont need to redo them.";
      status.classList.remove("error");
    }, 2500);
  }

  // Attach change listeners
  for (const id of SETTING_IDS) {
    const input = document.getElementById(id);
    if (!input) continue;

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
    } else if (id === "globalNukeActivity") {
      input.addEventListener("change", () => {
        saveSettings();
        updateDependencies();
      });
    } else {
      input.addEventListener("change", saveSettings);
    }
  }

  // Collapse/expand
  const goldIncomeHeader = document.getElementById("goldIncomeHeader");
  if (goldIncomeHeader) {
    goldIncomeHeader.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      toggleGoldIncomeSubs();
    });
  }

  // Main gold toggle
  const goldIncomeToggle = document.getElementById("goldIncome");
  if (goldIncomeToggle) {
    goldIncomeToggle.addEventListener("change", goldIncomeMainClicked);
  }

  // Troop rate collapse/expand
  const troopRateHeader = document.getElementById("troopRateHeader");
  if (troopRateHeader) {
    troopRateHeader.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      toggleTroopRateSubs();
    });
  }

  // Main troop toggle
  const troopRateToggle = document.getElementById("troopRate");
  if (troopRateToggle) {
    troopRateToggle.addEventListener("change", troopRateMainClicked);
  }

  // Trade partner collapse/expand
  const tradePartnerHeader = document.getElementById("tradePartnerHeader");
  if (tradePartnerHeader) {
    tradePartnerHeader.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      toggleTradePartnerSubs();
    });
  }

  // Main trade partner toggle
  const tradePartnerToggle = document.getElementById("tradePartner");
  if (tradePartnerToggle) {
    tradePartnerToggle.addEventListener("change", tradePartnerMainClicked);
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

  // Airspace collapse/expand
  const airspaceHeader = document.getElementById("airspaceHeader");
  if (airspaceHeader) {
    airspaceHeader.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      toggleAirspaceSubs();
    });
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
})();