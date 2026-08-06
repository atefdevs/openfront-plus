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
    goldPerSecond: true,
    goldPerMinute: true,
    troopPerSecond: false,
    troopPerMinute: false,
  });

  let settings = { ...DEFAULT_SETTINGS };
  let bridgeReady = false;

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
    if (data?.source !== PAGE_SOURCE || data.type !== "READY") return;
    bridgeReady = true;
    postSettings();
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;
    settings = normalizeSettings(changes[STORAGE_KEY].newValue);
    postSettings();
  });

  injectPageBridge();

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