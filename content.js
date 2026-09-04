(() => {
  "use strict";

  // Firefox uses `browser`, Chrome uses `chrome` — same promise-based API here.
  const browser = globalThis.browser ?? globalThis.chrome;

  const STORAGE_KEY = "openfrontNukeToolsSettings";
  const PAGE_SOURCE = "openfront-nuke-tools-page-v1";
  const EXTENSION_SOURCE = "openfront-nuke-tools-extension-v1";
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

  let settings = { ...DEFAULT_SETTINGS };
  let bridgeReady = false;

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    // Missing keys fall back to defaults. Additionally, a default-ON key that
    // reads as false WITHOUT a user-touch marker is treated as an artifact of
    // the pre-migration normalizer bug (which turned every newly shipped key
    // into false on first save) and is rescued once. After the user toggles a
    // switch, popup.js writes "<id>__touched": true and their choice sticks.
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

  function postSettings() {
    if (!bridgeReady) return;
    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        type: "SETTINGS",
        payload: settings,
      },
      "*"
    );
  }

  function injectPageBridge() {
    if (globalThis.__openfrontNukeToolsContentInjected) return;
    globalThis.__openfrontNukeToolsContentInjected = true;

    const inject = () => {
      const root = document.head || document.documentElement;
      if (!root) {
        window.setTimeout(inject, 0);
        return;
      }

      const script = document.createElement("script");
      script.src = browser.runtime.getURL("pagebridge.js");
      script.async = false;
      script.dataset.openfrontNukeTools = "true";
      script.addEventListener(
        "load",
        () => {
          script.remove();
        },
        { once: true }
      );
      script.addEventListener(
        "error",
        () => {
          script.remove();
        },
        { once: true }
      );
      root.appendChild(script);
    };

    inject();
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.source !== PAGE_SOURCE) return;

    if (data.type === "READY") {
      bridgeReady = true;
      // Record which bridge build is running so the popup can prove the
      // extension was actually reloaded (Chrome does not hot-reload files).
      try {
        const version = String(data.payload?.version ?? "unknown");
        browser.storage.local
          .get({ openfrontPlusBoots: [] })
          .then((stored) => {
            const list = Array.isArray(stored.openfrontPlusBoots) ? stored.openfrontPlusBoots.slice(-4) : [];
            list.push({ ts: Date.now(), version, host: location.hostname });
            return browser.storage.local.set({ openfrontPlusBoots: list.slice(-5) });
          })
          .catch(() => {});
      } catch (_) {}
      postSettings();
      return;
    }

  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;
    settings = normalizeSettings(changes[STORAGE_KEY].newValue);
    postSettings();
  });

  injectPageBridge();

  // Record that the content script itself started, with the page it runs on,
  // so the popup can distinguish "extension never injected" from
  // "injected but the bridge never booted".
  try {
    browser.storage.local
      .get({ openfrontPlusEvents: [] })
      .then((stored) => {
        const list = Array.isArray(stored.openfrontPlusEvents) ? stored.openfrontPlusEvents.slice(-9) : [];
        list.push({ ts: Date.now(), kind: "content-script", host: location.hostname, href: location.href.slice(0, 200) });
        return browser.storage.local.set({ openfrontPlusEvents: list.slice(-10) });
      })
      .catch(() => {});
  } catch (_) {}

  browser.storage.local
    .get(STORAGE_KEY)
    .then((stored) => {
      settings = normalizeSettings(stored[STORAGE_KEY]);
      postSettings();
    })
    .catch(() => {
      settings = { ...DEFAULT_SETTINGS };
      postSettings();
    });
})();