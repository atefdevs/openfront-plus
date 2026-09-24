(() => {
  "use strict";

  // Firefox uses `browser`, Chrome uses `chrome` — same promise-based API here.
  const browser = globalThis.browser ?? globalThis.chrome;

  const STORAGE_KEY = "openfrontNukeToolsSettings";
  const UI_KEY = "openfrontPlusUi";
  const DEFAULT_SETTINGS = Object.freeze({
    samCoverage: true,
    samHoverDelayMs: 1000,
    nukeGrouper: true,
    teammateMarkers: true,
    incomingNukeAlert: true,
    globalNukeActivity: true,
    personalNukeTracker: true,
    enemyNukeReadiness: false,
    intelDiplomacy: true,
    intelDoomsday: true,
    intelTeamTotals: true,
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
    { name: "playerIntel", master: "playerIntel", subs: ["intelDiplomacy", "intelDoomsday", "intelReadinessPct", "intelTargets", "intelTeamTotals"] },
    { name: "playerStats", master: "playerStatsOverlay", subs: ["overlayTroopRate", "overlayGoldIncome"] },
    { name: "goldIncome", master: "goldIncome", subs: ["goldPerSecond", "goldPerMinute"] },
    { name: "troopRate", master: "troopRate", subs: ["troopPerSecond", "troopPerMinute"] },
  ];

  /* Sections for grouping + per-section on-counts. */
  const SECTIONS = {
    nukes: ["samCoverage", "nukeGrouper", "incomingNukeAlert", "globalNukeActivity", "personalNukeTracker", "enemyNukeReadiness"],
    economy: ["tradeIncome", "tradeCaptures", "tradeTransports", "tradeWarships", "overlayTroopRate", "overlayGoldIncome", "goldPerSecond", "goldPerMinute", "troopPerSecond", "troopPerMinute", "intelDiplomacy", "intelDoomsday", "intelReadinessPct", "intelTargets", "intelTeamTotals"],
    map: ["teammateMarkers", "buildProgress"],
  };

  /* Persisted UI state (which groups/sections are expanded). Defaults open. */
  let uiState = { groups: {}, sections: {}, profile: null };
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
      if (key === "samHoverDelayMs") {
        const n = Number(source[key]);
        out[key] = Number.isFinite(n)
          ? Math.min(5000, Math.max(0, Math.round(n)))
          : 1000;
        continue;
      }
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

  // Numeric (non-toggle) settings live in the same storage object but are
  // edited through number inputs (seconds in the UI, ms in storage).
  const NUMERIC_SETTINGS = Object.freeze({
    samHoverDelayMs: { minMs: 0, maxMs: 5000, defaultMs: 1000 },
  });

  // Toggle ids (everything except numeric values like the hover delay).
  const TOGGLE_IDS = SETTING_IDS.filter((id) => !Object.hasOwn(NUMERIC_SETTINGS, id));

  // One-click profiles: curated toggle sets so a full setup (or a declutter)
  // never means flipping 22 switches by hand. Numeric values are untouched.
  const PROFILES = [
    {
      id: "defense", label: "Defense",
      on: ["samCoverage", "nukeGrouper", "incomingNukeAlert", "globalNukeActivity", "personalNukeTracker", "enemyNukeReadiness", "intelDiplomacy", "intelDoomsday", "intelReadinessPct", "intelTargets"],
    },
    {
      id: "economy", label: "Economy",
      on: ["tradeIncome", "overlayTroopRate", "overlayGoldIncome", "goldPerSecond", "goldPerMinute"],
    },
    {
      id: "intel", label: "Intel",
      on: ["enemyNukeReadiness", "intelDiplomacy", "intelDoomsday", "intelReadinessPct", "intelTargets", "overlayTroopRate", "overlayGoldIncome", "tradeIncome"],
    },
    {
      id: "minimal", label: "Minimal",
      on: ["teammateMarkers", "buildProgress"],
    },
    { id: "all", label: "All", on: TOGGLE_IDS.slice() },
  ];
  let activeProfile = null;

  function readForm() {
    const out = {};
    for (const id of SETTING_IDS) {
      if (Object.hasOwn(NUMERIC_SETTINGS, id)) {
        const input = document.getElementById(id);
        const secs = input ? Number.parseFloat(input.value) : Number.NaN;
        const ms = Number.isFinite(secs) ? Math.round(secs * 1000) : NUMERIC_SETTINGS[id].defaultMs;
        out[id] = Math.min(NUMERIC_SETTINGS[id].maxMs, Math.max(NUMERIC_SETTINGS[id].minMs, ms));
        continue;
      }
      const input = document.getElementById(id);
      out[id] = input ? input.checked : false;
      if (touchedIds.has(id)) out[id + "__touched"] = true;
    }
    return out;
  }

  function writeForm(settings) {
    for (const id of SETTING_IDS) {
      const input = document.getElementById(id);
      if (!input) continue;
      if (Object.hasOwn(NUMERIC_SETTINGS, id)) {
        const raw = Number(settings[id]);
        const ms = Number.isFinite(raw) ? raw : NUMERIC_SETTINGS[id].defaultMs;
        input.value = String(ms / 1000);
        continue;
      }
      input.checked = Boolean(settings[id]);
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
        clearProfile();
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
    refreshProfiles();
  }

  function refreshProfiles() {
    const wrap = document.getElementById("profileBtns");
    if (!wrap) return;
    if (wrap.childElementCount === 0) {
      for (const p of PROFILES) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "profile-btn";
        b.dataset.profile = p.id;
        b.textContent = p.label;
        b.addEventListener("click", () => applyProfile(p.id));
        wrap.appendChild(b);
      }
    }
    wrap.querySelectorAll(".profile-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.profile === activeProfile);
    });
  }

  function clearProfile() {
    if (activeProfile === null && uiState.profile == null) return;
    activeProfile = null;
    uiState.profile = null;
    saveUiState();
    refreshProfiles();
  }

  function applyProfile(id) {
    const def = PROFILES.find((p) => p.id === id);
    if (!def) return;
    for (const tid of TOGGLE_IDS) {
      const input = getInput(tid);
      if (input) {
        input.checked = def.on.includes(tid);
        markTouched(tid);
      }
    }
    activeProfile = id;
    uiState.profile = id;
    saveUiState();
    saveSettings();
    refreshAll();
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
    // Numeric settings (hover delay) are values, not toggles — the total
    // counts toggles only so "Enable all" reads 21 of 21, not 21 of 22.
    const totalToggles = SETTING_IDS.filter((id) => !Object.hasOwn(NUMERIC_SETTINGS, id)).length;
    if (countEl) countEl.textContent = `${totalOn} of ${totalToggles} on`;
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
    // Enable all / Disable all only flips toggles — numeric values like the
    // hover delay are left untouched.
    for (const id of SETTING_IDS) {
      if (Object.hasOwn(NUMERIC_SETTINGS, id)) continue;
      const input = getInput(id);
      if (input) {
        input.checked = on;
        markTouched(id);
      }
    }
    activeProfile = on ? "all" : null;
    uiState.profile = activeProfile;
    saveUiState();
    saveSettings();
    refreshAll();
  }

  /* ---------- diagnostics ---------- */

  function renderBridgeInfo() {
    browser.storage.local
      .get({ openfrontPlusBoots: [], openfrontPlusEvents: [], openfrontPlusMeta: null })
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
        const metaSeen = stored?.openfrontPlusMeta?.lastSeenVersion ?? null;
        const seenLine = document.createElement("div");
        seenLine.textContent = `Release notes seen: ${metaSeen ?? mirrorSeen() ?? "never"}`;
        body.appendChild(seenLine);
      })
      .catch(() => {});
  }

  /* ---------- wiring ---------- */

  // Linux-only emoji fallback: Windows/macOS render color emoji natively, so
  // only tag Linux. The CSS rule for `html.of-linux` merely extends the font
  // stack — Windows rendering is byte-identical.
  try {
    const uaDataPlatform = String(navigator?.userAgentData?.platform ?? "").toLowerCase();
    let isLinux = false;
    if (uaDataPlatform) {
      isLinux = uaDataPlatform.includes("linux");
    } else {
      const ua = String(navigator?.userAgent ?? "").toLowerCase();
      const plat = String(navigator?.platform ?? "").toLowerCase();
      isLinux = !ua.includes("cros") && !ua.includes("android") &&
        (plat.includes("linux") || (ua.includes("linux") && !ua.includes("android")));
    }
    if (isLinux) document.documentElement.classList.add("of-linux");
  } catch (_) {}

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
    activeProfile = null;
    uiState.profile = null;
    saveUiState();
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
  // Numeric settings save on change without a touch marker (missing/invalid
  // values always fall back to the default, so no rescue logic is needed).
  for (const id of SETTING_IDS) {
    const input = getInput(id);
    if (!input) continue;
    input.addEventListener("change", () => {
      if (!Object.hasOwn(NUMERIC_SETTINGS, id)) markTouched(id);
      clearProfile();
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
          profile: typeof v.profile === "string" ? v.profile : null,
        };
      }
      activeProfile = uiState.profile;
      applyGroupOpenStates();
      applySectionOpenStates();
      refreshProfiles();
    })
    .catch(() => {});

  /* ---------- what's new ---------- */

  const META_KEY = "openfrontPlusMeta";
  // Release notes shown once per version, oldest first. Add a new entry on
  // top for every release with user-facing changes.
  const CHANGELOG = [
    {
      version: "4.7",
      notes: [
        "Nuke impact timers, click-to-jump and trade-ship distances work on the latest game update again.",
        "Trade row ship counts are back.",
      ],
    },
    {
      version: "4.8",
      notes: [
        "SAM intercept estimates stay accurate late in a nuke's flight.",
        "Accepting an alliance no longer triggers false \"Intercepted!\" alerts.",
      ],
    },
    {
      version: "4.9",
      notes: [
        "Retaking your own captured trade ship no longer counts as a capture in naval stats.",
        "Returned ships credit trade income only to you, matching the game.",
      ],
    },
    {
      version: "5.0",
      notes: [
        "The popup now shows these release notes after every update.",
        "Gold Income totals now come from the game's own counters — exact, matching the leaderboard, conquest loot excluded.",
        "Embargo & Doomsday hover row split into two separate switches.",
        "New one-click setting profiles: Defense, Economy, Intel, Minimal, All.",
        "New hover row: Team Totals — team games show the hovered player's team structures and income, summed.",
      ],
    },
  ];

  function parseVersion(value) {
    const m = String(value ?? "").match(/(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2])] : null;
  }

  function isNewerVersion(a, b) {
    const pa = parseVersion(a), pb = parseVersion(b);
    if (!pa || !pb) return false;
    return pa[0] > pb[0] || (pa[0] === pb[0] && pa[1] > pb[1]);
  }

  function persistSeen(version) {
    // Synchronous mirror first: it survives even if the popup unloads before
    // the async storage write below lands (which silently drops the save and
    // makes the card reappear on next open).
    try {
      localStorage.setItem("ofplus-notes-seen", version);
    } catch (_) {}
    try {
      browser.storage.local.set({ [META_KEY]: { lastSeenVersion: version } });
    } catch (_) {}
  }

  function mirrorSeen() {
    try {
      return localStorage.getItem("ofplus-notes-seen");
    } catch (_) {
      return null;
    }
  }

  function checkWhatsNew() {
    let current = null;
    try {
      current = browser.runtime.getManifest().version;
    } catch (_) {}
    if (!parseVersion(current)) return;
    browser.storage.local
      .get([META_KEY, STORAGE_KEY])
      .then((stored) => {
        const raw = stored?.[META_KEY];
        const lastSeen = (raw && typeof raw === "object" ? raw.lastSeenVersion : null)
          ?? mirrorSeen();
        // No meta key yet: a fresh install has no saved settings either, so a
        // present settings object means an updater from pre-5.0 — they get the
        // full backfill, not just the current version's notes.
        const freshInstall = !raw && stored?.[STORAGE_KEY] == null;
        // Fresh installs see only the current version's notes; updaters see
        // everything since the version they last saw.
        const pending = freshInstall
          ? CHANGELOG.filter((e) => e.version === current)
          : CHANGELOG.filter(
            (e) => parseVersion(e.version) && (!lastSeen || isNewerVersion(e.version, lastSeen)),
          );
        if (pending.length === 0) {
          persistSeen(current);
          return;
        }
        const card = document.getElementById("whatsnew");
        const title = document.getElementById("whatsnewTitle");
        const body = document.getElementById("whatsnewBody");
        if (!card || !title || !body) return;
        title.textContent = freshInstall ? "Welcome to Openfront+ 🎉" : "What's new 🎉";
        body.replaceChildren();
        for (const entry of pending) {
          const ver = document.createElement("div");
          ver.className = "whatsnew-ver";
          ver.textContent = `v${entry.version}`;
          body.appendChild(ver);
          const list = document.createElement("ul");
          for (const note of entry.notes) {
            const li = document.createElement("li");
            li.textContent = note;
            list.appendChild(li);
          }
          body.appendChild(list);
        }
        card.hidden = false;
      })
      .catch(() => {});
  }

  document.getElementById("whatsnewDismiss")?.addEventListener("click", () => {
    let current = null;
    try {
      current = browser.runtime.getManifest().version;
    } catch (_) {}
    if (current) persistSeen(current);
    const card = document.getElementById("whatsnew");
    if (card) card.hidden = true;
  });

  /* ---------- review nudge ---------- */

  const REVIEW_KEY = "openfrontPlusReview";
  const REVIEW_URL = "https://addons.mozilla.org/en-US/firefox/addon/openfront/";
  const REVIEW_DAY_MS = 86400000;
  const REVIEW_SNOOZE_OPENS = 5;
  let reviewState = null;

  function persistReview() {
    try {
      browser.storage.local.set({ [REVIEW_KEY]: reviewState });
    } catch (_) {}
  }

  function hideReview() {
    const overlay = document.getElementById("reviewOverlay");
    if (overlay) overlay.hidden = true;
  }

  function showReview() {
    const overlay = document.getElementById("reviewOverlay");
    if (overlay) overlay.hidden = false;
  }

  function checkReviewPrompt() {
    browser.storage.local
      .get(REVIEW_KEY)
      .then((stored) => {
        const raw = stored?.[REVIEW_KEY];
        reviewState = {
          opens: 0,
          state: "pending",
          snoozedAt: 0,
          snoozeOpens: 0,
          ...(raw && typeof raw === "object" ? raw : {}),
        };
        reviewState.opens = (Number(reviewState.opens) || 0) + 1;
        persistReview();
        if (reviewState.state === "no" || reviewState.state === "done") return;
        if (reviewState.state === "later") {
          const opensSince = reviewState.opens - (Number(reviewState.snoozeOpens) || 0);
          if (opensSince < REVIEW_SNOOZE_OPENS) return;
          if (Date.now() - (Number(reviewState.snoozedAt) || 0) < REVIEW_DAY_MS) return;
        } else if (reviewState.opens < 3) {
          return;
        }
        showReview();
      })
      .catch(() => {});
  }

  document.getElementById("reviewSure")?.addEventListener("click", () => {
    if (reviewState) {
      reviewState.state = "done";
      persistReview();
    }
    hideReview();
    try {
      const tabs = browser.tabs;
      if (tabs && typeof tabs.create === "function") {
        const opened = tabs.create({ url: REVIEW_URL });
        if (opened && typeof opened.catch === "function") {
          opened.catch(() => {
            try { window.open(REVIEW_URL, "_blank"); } catch (_) {}
          });
        }
      } else {
        window.open(REVIEW_URL, "_blank");
      }
    } catch (_) {
      try { window.open(REVIEW_URL, "_blank"); } catch (_) {}
    }
    try { window.close(); } catch (_) {}
  });

  document.getElementById("reviewLater")?.addEventListener("click", () => {
    if (reviewState) {
      reviewState.state = "later";
      reviewState.snoozedAt = Date.now();
      reviewState.snoozeOpens = reviewState.opens;
      persistReview();
    }
    hideReview();
  });

  document.getElementById("reviewNo")?.addEventListener("click", () => {
    if (reviewState) {
      reviewState.state = "no";
      persistReview();
    }
    hideReview();
  });

  renderBridgeInfo();
  checkReviewPrompt();
  checkWhatsNew();
})();
