(() => {
  "use strict";

  if (globalThis.__openfrontNukeToolsPagebridgeLoaded) return;
  globalThis.__openfrontNukeToolsPagebridgeLoaded = true;

  const PAGE_SOURCE = "openfront-nuke-tools-page-v1";
  const EXTENSION_SOURCE = "openfront-nuke-tools-extension-v1";

  const SAM_LABEL_ID = "of-nuke-tools-sam-label";
  const SAM_STYLE_ID = "of-nuke-tools-sam-style";
  const NUKE_LAYER_ID = "of-nuke-tools-nuke-layer";
  const NUKE_STYLE_ID = "of-nuke-tools-nuke-style";
  const TEAMMATE_LAYER_ID = "of-nuke-tools-teammate-layer";
  const TEAMMATE_STYLE_ID = "of-nuke-tools-teammate-style";
  const ALERT_PANEL_ID = "of-nuke-tools-alert-panel";
  const ALERT_STYLE_ID = "of-nuke-tools-alert-style";
  const GLOBAL_ACTIVITY_PANEL_ID = "of-nuke-tools-global-activity";
  const GLOBAL_ACTIVITY_STYLE_ID = "of-nuke-tools-global-activity-style";
  const GOLD_INCOME_STYLE_ID = "of-nuke-tools-gold-income-style";
  const ENEMY_NUKES_HOVER_ID = "of-nuke-tools-enemy-nukes-hover";
  const TRADE_PARTNER_HOVER_ID = "of-nuke-tools-trade-partner-hover";
  const TRADE_CAPTURES_HOVER_ID = "of-nuke-tools-trade-captures-hover";
  const TRADE_TRANSPORTS_HOVER_ID = "of-nuke-tools-trade-transports-hover";
  const TRADE_WARSHIPS_HOVER_ID = "of-nuke-tools-trade-warships-hover";
  // Nuke costs from Config. Atom is flat 750k, Hydrogen 5M; a MIRV carrier is
  // 25M + 15M per MIRV already launched this game. The live MIRV price is read
  // from the player's `buildables()` worker call — 25M is just the fallback.
  const NUKE_COST_REFRESH_MS = 2000;
  const NUKE_COST_FALLBACK = { atom: 750000, hydro: 5000000, mirv: 25000000 };

  const SAM_SETTLE_MS = 1500;
  const SAM_MODE_POLL_MS = 300;
  const SAM_CACHE_MS = 750;
  const ATOM_COST = 750000;
  const OWNER_GOLD_STEP = 3000000;
  const MAX_OWNER_POTENTIAL = 3;
  const NUKE_SCAN_MS = 400;
  const ATOM_GROUP_RADIUS_MULTIPLIER = 3;
  const TEAMMATE_SCAN_MS = 500;
  const CONTEXT_REFRESH_MS = 1000;
  // In the lobby there's nothing to discover, and without a negative cache
  // every loop would hit the DOM every frame.
  const CONTEXT_MISS_MS = 1000;
  const FULL_CONTEXT_SCAN_MS = 10000;
  // hasKnownGameSurface() does two full-DOM scans; the surface barely ever
  // mounts/unmounts, so cache it for a bit.
  const KNOWN_SURFACE_MS = 500;
  // game.units(type) filters the whole map — every feature shares one snapshot
  // per (game, type) instead of rebuilding it each frame.
  const UNIT_CACHE_MS = 200;
  const TICKS_PER_SECOND = 10;
  const SAM_COOLDOWN_TICKS = 90;
  const DEFAULT_MAX_SAM_RANGE = 150;
  const NUKE_SPEED_TILES_PER_TICK = 5.5;
  // Passive floor from Config.goldAdditionRate(): 100/tick (human) or 50/tick
  // (bot), times the lobby goldMultiplier. Ships and trains are lumps on top.
  const BASE_GOLD_PER_TICK = 100;
  const BOT_GOLD_PER_TICK = 50;
  // Income average window. Ships arrive as 30k–1m lumps, trains 10k–35k per
  // stop, so the window has to be long enough to smooth those out.
  const GOLD_SAMPLE_WINDOW_MS = 60000;
  // Killing a player pays loot in the same tick the alive count drops; hold
  // samples around that so conquest loot never inflates the income number.
  const GOLD_LOOT_HOLD_MS = 500;
  // The game's unit type string is "MIRV Warhead" — note the space.
  const MIRV_WARHEAD_TYPE = "MIRV Warhead";
  // Exact UnitType enum strings.
  const TRADE_SHIP_TYPE = "Trade Ship";
  const TRAIN_TYPE = "Train";
  const CITY_TYPE = "City";
  const PORT_TYPE = "Port";
  const WARSHIP_TYPE = "Warship";
  const TRANSPORT_SHIP_TYPE = "Transport Ship";
  const TRAIN_ENGINE_TYPE = "Engine";
  // Trains move several tiles a tick, so a stop can slip between our 100ms
  // samples; give the engine-tile match this much slack.
  const TRAIN_STATION_RADIUS = 3;
  // A freshly-seen ship has an incomplete distance total — don't trust an
  // arrival until it's been tracked for a bit.
  const SHIP_MIN_TRACK_MS = 400;
  // Ships despawn on the destination port; client snapshots lag ~2-4 tiles.
  const SHIP_ARRIVE_RADIUS = 5;

  const FALLBACK_TEAM_COLORS = [
    "#ef4444", "#3b82f6", "#14b8a6", "#a855f7", "#facc15", "#f97316", "#22c55e",
  ];
  const NAMED_TEAM_COLORS = {
    red: "#ef4444", blue: "#3b82f6", teal: "#14b8a6", purple: "#a855f7",
    yellow: "#facc15", orange: "#f97316", green: "#22c55e",
  };

  const settings = {
    samCoverage: false,
    nukeGrouper: false,
    teammateMarkers: false,
    incomingNukeAlert: false,
    globalNukeActivity: false,
    personalNukeTracker: false,
    enemyNukeReadiness: false,
    tradeIncome: false,
    tradeCaptures: false,
    tradeTransports: false,
    tradeWarships: false,
    goldPerSecond: false,
    goldPerMinute: false,
    troopPerSecond: false,
    troopPerMinute: false,
  };

  // ---------- shared state ----------
  let cachedContext = null;
  let lastContextRefreshAt = 0;
  let lastContextMissAt = Number.NEGATIVE_INFINITY;
  let lastFullContextScanAt = Number.NEGATIVE_INFINITY;
  let cachedPlayerViewsGame = null;
  let cachedPlayerViewsTick = Number.NaN;
  let cachedPlayerViewsAt = 0;
  let cachedPlayerViews = [];

  // Gold income state
  let goldIncomePanelVisible = false;
  let goldSampleHistory = [];
  let lastAliveCount = 0;
  let lootHoldUntil = 0;
  // Source-split events (which bucket a payout lands in)
  let shipIncomeEvents = []; // normal port-to-port arrivals -> "ports"
  let warshipIncomeEvents = []; // captured-ship arrivals -> "warships"
  let factoryIncomeEvents = []; // train station stops -> "factories"
  let shipTrackers = new Map(); // unitId -> { dist, lastTile, firstTile, owner, firstOwner, seenAt, dstId, dstTile, dstOwner }
  let trainTrackers = new Map(); // engineId -> { stops, lastStopKey, lastTile, owner }

  // Troop rate state
  let troopRatePanelVisible = false;
  let troopSampleHistory = [];
  let lastDisplayedRate = null;

  const objectIds = new WeakMap();
  let nextObjectId = 1;

  /* helpers */
  function readProperty(t, k) { try { return t?.[k]; } catch (_) { return undefined; } }
  function callMethod(t, k, ...a) {
    const m = readProperty(t, k);
    if (typeof m !== "function") return undefined;
    try { return m.apply(t, a); } catch (_) { return undefined; }
  }
  function toFiniteNumber(v, fb = Number.NaN) {
    if (v === null || v === undefined || v === "") return fb;
    const n = typeof v === "bigint" ? Number(v) : Number(v);
    return Number.isFinite(n) ? n : fb;
  }
  function getObjectId(v) {
    if (v === null || (typeof v !== "object" && typeof v !== "function")) return String(v);
    let id = objectIds.get(v);
    if (!id) { id = nextObjectId++; objectIds.set(v, id); }
    return `object:${id}`;
  }
  function appendStyle(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* game context discovery */
  function isUsableGame(v) {
    return Boolean(v && (
      typeof readProperty(v, "playerViews") === "function" ||
      typeof readProperty(v, "units") === "function"
    ));
  }
  function isUsableTransform(v) {
    return Boolean(v && typeof readProperty(v, "worldToScreenCoordinates") === "function");
  }
  function rememberContext(g, t) {
    if (!isUsableGame(g) || !isUsableTransform(t)) return null;
    cachedContext = { game: g, transform: t };
    return cachedContext;
  }
  function collectContextCandidates(els) {
    const games = [], transforms = [];
    const gameKeys = ["game", "g", "gameView", "gameInstance", "gameState", "gameEngine",
                      "gameContext", "clientGame", "gameSurface"];
    const transformKeys = ["transformHandler", "transform", "camera", "viewport",
                           "cameraTransform", "viewTransform", "screenTransform"];
    for (const el of els) {
      if (!el) continue;
      const gs = gameKeys.map(k => readProperty(el, k)).filter(Boolean);
      const ts = transformKeys.map(k => readProperty(el, k)).filter(Boolean);
      for (const g of gs) if (isUsableGame(g) && !games.includes(g)) games.push(g);
      for (const t of ts) if (isUsableTransform(t) && !transforms.includes(t)) transforms.push(t);
      for (const g of gs) for (const t of ts) {
        const ctx = rememberContext(g, t); if (ctx) return ctx;
      }
    }
    for (const g of games) for (const t of transforms) {
      const ctx = rememberContext(g, t); if (ctx) return ctx;
    }
    return null;
  }
  // Known custom-element names. Cast a wide net — the v0.32 renderer rewrite
  // renamed a bunch of these and we don't want to miss the game after an update.
  const KNOWN_SELS = [
    // pre-v0.32 names
    "player-info-overlay", "player-panel", "emoji-table", "build-menu",
    "main-radial-menu", "game-left-sidebar", "game-right-sidebar",
    "leader-board", "team-stats", "spawn-timer", "unit-display", "control-panel",
    // plausible v0.32 names after the renderer rewrite
    "game-canvas", "game-view", "game-hud", "game-ui", "game-overlay",
    "game-container", "game-panel", "game-sidebar", "game-renderer",
    "hud-overlay", "hud-panel", "hud-container",
    "player-hud", "player-ui", "player-stats",
    "radial-menu", "action-menu", "context-menu",
    "leaderboard-panel", "score-panel",
    "spawn-overlay", "spawn-panel", "spawn-view",
    "game-app", "app-root", "of-game", "openfront-game",
  ];

  function discoverKnownContext() {
    const els = [];
    for (const sel of KNOWN_SELS) {
      const el = document.querySelector(sel);
      if (el) {
        els.push(el);
        // Also probe child properties like buildMenu
        for (const key of ["buildMenu", "game", "gameView", "renderer", "hud"]) {
          const n = readProperty(el, key);
          if (n && typeof n === "object") els.push(n);
        }
      }
    }
    return collectContextCandidates(els);
  }

  function discoverContextFromAllCustomElements() {
    // Custom elements (tagName contains "-") are where the game keeps state,
    // and scanning just those is way cheaper than scanning every element.
    try {
      const customEls = Array.from(document.querySelectorAll("*")).filter(
        el => el.tagName.includes("-")
      );
      const ctx = collectContextCandidates(customEls);
      if (ctx) return ctx;
    } catch (_) {}
    return null;
  }

  function discoverContextFromAllElements() {
    try { return collectContextCandidates(Array.from(document.querySelectorAll("*"))); } catch (_) { return null; }
  }

  // Last resort: also probe window globals the game might have left around
  function discoverContextFromWindow() {
    try {
      const candidates = [];
      for (const key of Object.keys(window)) {
        try {
          const val = window[key];
          if (val && typeof val === "object" && isUsableGame(val)) candidates.push(val);
          if (val && typeof val === "object") {
            const g = readProperty(val, "game") ?? readProperty(val, "gameView");
            if (isUsableGame(g)) candidates.push(g);
          }
        } catch (_) {}
      }
      for (const g of candidates) {
        for (const tKey of ["transformHandler", "transform", "camera", "renderer", "viewport"]) {
          const t = readProperty(g, tKey);
          if (isUsableTransform(t)) {
            const ctx = rememberContext(g, t);
            if (ctx) return ctx;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  let cachedKnownSurface = null;
  let lastKnownSurfaceCheckAt = 0;
  function hasKnownGameSurface() {
    // Any custom element present = the game is mounted. Two full-DOM scans per
    // call, and isGameActive() asks every tick, so this is cached hard.
    const now = performance.now();
    if (cachedKnownSurface !== null && now - lastKnownSurfaceCheckAt < KNOWN_SURFACE_MS) return cachedKnownSurface;
    lastKnownSurfaceCheckAt = now;
    try {
      cachedKnownSurface = document.querySelectorAll("*[class]").length > 10 &&
        Array.from(document.querySelectorAll("*")).some(el => el.tagName.includes("-"));
      return cachedKnownSurface;
    } catch (_) {
      cachedKnownSurface = false;
      return false;
    }
  }
  function getGameContext() {
    const now = performance.now();
    if (now - lastContextRefreshAt < CONTEXT_REFRESH_MS &&
        isUsableGame(cachedContext?.game) && isUsableTransform(cachedContext?.transform)) return cachedContext;
    // Negative cache: if nothing was found, back off for a moment instead of
    // rescanning the whole DOM on every single frame.
    if (!cachedContext && now - lastContextMissAt < CONTEXT_MISS_MS) return null;
    lastContextRefreshAt = now;

    // Fastest path first: known selectors
    const known = discoverKnownContext();
    if (known) return known;

    // Then all custom elements (cheaper than everything)
    const fromCustom = discoverContextFromAllCustomElements();
    if (fromCustom) return fromCustom;
    lastContextMissAt = now;

    if (cachedContext && !hasKnownGameSurface()) {
      cachedContext = null; cachedPlayerViewsGame = null; cachedPlayerViews = [];
    }

    // Heavier fallbacks on a timer
    if (!cachedContext && now - lastFullContextScanAt >= FULL_CONTEXT_SCAN_MS) {
      lastFullContextScanAt = now;
      const fromWin = discoverContextFromWindow();
      if (fromWin) return fromWin;
      const fb = discoverContextFromAllElements();
      if (fb) return fb;
    }

    return (isUsableGame(cachedContext?.game) && isUsableTransform(cachedContext?.transform)) ? cachedContext : null;
  }
  function getGameTick(g) { return toFiniteNumber(callMethod(g, "ticks")); }
  function getPlayerViews(g) {
    const now = performance.now(), tick = getGameTick(g);
    if (g === cachedPlayerViewsGame && ((Number.isFinite(tick) && tick === cachedPlayerViewsTick) || now - cachedPlayerViewsAt < 200))
      return cachedPlayerViews;
    cachedPlayerViewsGame = g; cachedPlayerViewsTick = tick; cachedPlayerViewsAt = now;
    try { cachedPlayerViews = Array.from(callMethod(g, "playerViews") || []); } catch (_) { cachedPlayerViews = []; }
    return cachedPlayerViews;
  }
  function getMyPlayer(g) {
    return callMethod(g, "myPlayer") ?? readProperty(g, "myPlayer") ??
           callMethod(g, "me") ?? readProperty(g, "me") ?? null;
  }
  function getPlayerId(p) {
    const vals = [callMethod(p, "smallID"), callMethod(p, "id"),
                  readProperty(readProperty(p, "data"), "smallID"), readProperty(readProperty(p, "data"), "id")];
    for (const v of vals) if (v !== undefined && v !== null) return String(v);
    return getObjectId(p);
  }
  function getPlayerTeam(p) {
    // The team may live on the player, a nested data object, or be a method.
    // During spawn phases, however, the field can also be a number or a
    // different name, so try the common variants before falling back.
    const sources = [
      callMethod(p, "team"),
      readProperty(p, "team"),
      callMethod(readProperty(p, "data"), "team"),
      readProperty(readProperty(p, "data"), "team"),
      callMethod(p, "teamId"),
      readProperty(p, "teamId"),
      callMethod(p, "playerTeamId"),
      readProperty(p, "playerTeamId"),
      readProperty(p, "unitTeam"),
      readProperty(p, "affiliation"),
    ];
    for (const raw of sources) {
      if (typeof raw === "number") return String(raw);
      if (typeof raw === "string" && raw.trim() && raw !== "null" && raw !== "undefined") return raw;
    }
    return null;
  }
  function isSamePlayer(a, b) { if (!a || !b) return false; if (a === b) return true; return getPlayerId(a) === getPlayerId(b); }
  function isOnSameTeam(a, b) {
    if (!a || !b || isSamePlayer(a, b)) return false;
    const d = callMethod(a, "isOnSameTeam", b);
    if (typeof d === "boolean") return d;
    return Boolean(getPlayerTeam(a) && getPlayerTeam(b) && getPlayerTeam(a) === getPlayerTeam(b));
  }
  function getRelationToMe(g, p) {
    const me = getMyPlayer(g); if (!me || !p) return null;
    if (isSamePlayer(me, p)) return "self";
    if (isOnSameTeam(me, p)) return "ally";
    if (callMethod(p, "isFriendly", me) === true || callMethod(me, "isFriendly", p) === true) return "ally";
    return "enemy";
  }
  function getPlayerGold(p) { return toFiniteNumber(callMethod(p, "gold") ?? readProperty(readProperty(p, "data"), "gold")); }
  function getPlayerType(p) {
    return String(callMethod(p, "type") ?? readProperty(readProperty(p, "data"), "playerType") ?? "").trim().toUpperCase();
  }
  function isNationOrBot(p) {
    const t = getPlayerType(p);
    if (t === "NATION" || t === "BOT" || t.includes("NATION") || t.includes("BOT")) return true;
    return callMethod(p, "isNationBot") === true || callMethod(p, "isNation") === true || callMethod(p, "isBot") === true;
  }

  // -------- unit data helpers (game internals shimmed across builds) --------
  function getUnitId(u) {
    const id = callMethod(u, "id") ?? readProperty(readProperty(u, "data"), "id");
    return id === undefined || id === null ? null : String(id);
  }
  function getUnitType(u) { return String(callMethod(u, "type") ?? readProperty(readProperty(u, "data"), "unitType") ?? ""); }
  function getUnitOwner(u) { return callMethod(u, "owner") ?? readProperty(readProperty(u, "data"), "owner") ?? null; }

  function getUnitTile(u) {
    let raw = readProperty(u, "tile");
    if (typeof raw === "function") raw = callMethod(u, "tile");
    if (raw === undefined || raw === null) {
      raw = readProperty(readProperty(u, "data"), "tile");
      if (typeof raw === "function") raw = callMethod(readProperty(u, "data"), "tile");
    }
    return toFiniteNumber(raw, null);
  }

  function getUnitLevel(u) {
    let raw = readProperty(u, "level");
    if (typeof raw === "function") raw = callMethod(u, "level");
    if (raw === undefined || raw === null) {
      raw = readProperty(readProperty(u, "data"), "level");
      if (typeof raw === "function") raw = callMethod(readProperty(u, "data"), "level");
    }
    return Math.max(1, Math.floor(toFiniteNumber(raw, 1)));
  }

  function getMissileTimerQueue(u) {
    let raw = readProperty(u, "missileTimerQueue");
    if (typeof raw === "function") raw = callMethod(u, "missileTimerQueue");
    if (raw === undefined || raw === null) {
      raw = readProperty(readProperty(u, "data"), "missileTimerQueue");
      if (typeof raw === "function") raw = callMethod(readProperty(u, "data"), "missileTimerQueue");
    }
    if (Array.isArray(raw)) return raw.map(v => toFiniteNumber(v, 0));
    if (raw && typeof raw.values === "function") {
      try { return Array.from(raw.values()).map(v => toFiniteNumber(v, 0)); } catch (_) {}
    }
    if (typeof raw === "number") return [raw];
    try { return Array.from(raw || []).map(v => toFiniteNumber(v, 0)); } catch (_) {}
    return [];
  }

  function getSamCooldownTicks(g) {
    const cfg = callMethod(g, "config") ?? readProperty(g, "config") ?? null;
    const cd = toFiniteNumber(callMethod(cfg, "SAMCooldown"));
    return Number.isFinite(cd) && cd > 0 ? cd : SAM_COOLDOWN_TICKS;
  }

  function getSamAvailableShotsNow(u) {
    return Math.max(0, getUnitLevel(u) - getMissileTimerQueue(u).length);
  }

  function estimateSamShotsInWindow(g, u, tw) {
    if (!Number.isFinite(tw) || tw < 0) return 0;
    const cooldown = getSamCooldownTicks(g), level = getUnitLevel(u), queue = getMissileTimerQueue(u);
    const nowTicks = getGameTick(g);
    let shots = 0;
    const free = Math.max(0, level - queue.length);
    if (free > 0) shots += free * (Math.floor(tw / cooldown) + 1);
    for (const launched of queue) {
      const elapsed = Number.isFinite(nowTicks) ? nowTicks - launched : cooldown;
      const remaining = Math.max(0, cooldown - elapsed);
      if (remaining <= tw) shots += Math.floor((tw - remaining) / cooldown) + 1;
    }
    return shots;
  }

  function isActiveFinishedUnit(u) {
    if (typeof readProperty(u, "isActive") === "function" && callMethod(u, "isActive") !== true) return false;
    if (callMethod(u, "isUnderConstruction") === true) return false;
    if (callMethod(u, "isDestroyed") === true || readProperty(readProperty(u, "data"), "destroyed") === true) return false;
    return true;
  }

  function getGameUnits(g, type) {
    const m = readProperty(g, "units");
    if (typeof m !== "function") return { available: false, units: [] };
    try { return { available: true, units: Array.from(m.call(g, type) || []) }; }
    catch (_) { return { available: false, units: [] }; }
  }
  // One 200ms snapshot per (game, type), shared by every feature. game.units()
  // filters the whole map, so sharing keeps the scan count sane.
  // Callers: don't mutate the returned array.
  let unitCacheGame = null;
  const unitSnapshotCache = new Map();
  function getGameUnitsCached(g, type) {
    const now = performance.now();
    if (unitCacheGame !== g) { unitCacheGame = g; unitSnapshotCache.clear(); }
    const hit = unitSnapshotCache.get(type);
    if (hit && now - hit.at < UNIT_CACHE_MS) return hit.res;
    const res = getGameUnits(g, type);
    unitSnapshotCache.set(type, { at: now, res });
    return res;
  }
  function getPlayerUnits(p, type) {
    const m = readProperty(p, "units");
    if (typeof m !== "function") return { available: false, units: [] };
    try { return { available: true, units: Array.from(m.call(p, type) || []) }; }
    catch (_) { return { available: false, units: [] }; }
  }
  function getDistanceSquared(g, a, b) {
    const d = toFiniteNumber(callMethod(g, "euclideanDistSquared", a, b));
    if (Number.isFinite(d)) return d;
    const ax = toFiniteNumber(callMethod(g, "x", a)), ay = toFiniteNumber(callMethod(g, "y", a));
    const bx = toFiniteNumber(callMethod(g, "x", b)), by = toFiniteNumber(callMethod(g, "y", b));
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return Infinity;
    return (ax - bx) ** 2 + (ay - by) ** 2;
  }
  function worldToScreen(t, w) { return callMethod(t, "worldToScreenCoordinates", w) || null; }
  function tileToWorld(g, tile) {
    const x = toFiniteNumber(callMethod(g, "x", tile)), y = toFiniteNumber(callMethod(g, "y", tile));
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  // === SAM Coverage ===
  let samModeActive = false;
  let samSettleTimeout = null;
  let lastMouseX = null, lastMouseY = null;
  let canvasCacheAt = 0, canvasCache = null;
  let samDataCache = { game: null, at: 0, available: false, sams: [] };

  function ensureSamStyle() {
    appendStyle(SAM_STYLE_ID, `
      #${SAM_LABEL_ID} {
        position: fixed; z-index: 2147483647; pointer-events: none;
        padding: 7px 10px; border: 1px solid rgba(250,204,21,0.62); border-radius: 7px;
        background: rgba(7,16,25,0.95); color: #f8fafc;
        box-shadow: 0 8px 24px rgba(0,0,0,0.44), 0 0 16px rgba(250,204,21,0.2);
        font: 900 12px/1 system-ui, sans-serif; letter-spacing: 0.02em; white-space: nowrap;
      }
      #${SAM_LABEL_ID} .of-nuke-tools-potential { color: #fbbf24; }
      #${SAM_LABEL_ID} .of-nuke-tools-cost {
        display: block; margin-top: 6px; color: #fde68a; font-size: 11px; font-weight: 800;
      }
      #${SAM_LABEL_ID} .of-nuke-tools-tracking { color: #cbd5e1; }
    `);
  }

  function ensureSamLabel() {
    ensureSamStyle();
    let label = document.getElementById(SAM_LABEL_ID);
    if (!label) {
      label = document.createElement("div");
      label.id = SAM_LABEL_ID; label.hidden = true;
      label.setAttribute("aria-hidden", "true");
      (document.body || document.documentElement).appendChild(label);
    }
    return label;
  }

  function hideSamLabel() { const el = document.getElementById(SAM_LABEL_ID); if (el) el.hidden = true; }

  function positionSamLabel(label, x, y) {
    label.style.left = "0px"; label.style.top = "0px";
    const rect = label.getBoundingClientRect();
    const left = Math.min(Math.max(8, x + 18), Math.max(8, window.innerWidth - rect.width - 8));
    const top = Math.min(Math.max(8, y + 18), Math.max(8, window.innerHeight - rect.height - 8));
    label.style.left = `${Math.round(left)}px`;
    label.style.top = `${Math.round(top)}px`;
  }

  function renderSamTracking(x, y) {
    const label = ensureSamLabel(); label.replaceChildren();
    const tracking = document.createElement("span");
    tracking.className = "of-nuke-tools-tracking";
    tracking.textContent = "☢ tracking";
    label.appendChild(tracking); label.hidden = false;
    positionSamLabel(label, x, y);
  }

  function formatGold(value) {
    const amt = Math.max(0, Number(value) || 0);
    if (amt >= 1e6) return `${(amt / 1e6).toFixed(2)}m`;
    if (amt >= 1e3) return `${(amt / 1e3).toFixed(2)}k`;
    return String(Math.round(amt));
  }

  function renderSamEstimate(x, y, est) {
    const label = ensureSamLabel(); label.replaceChildren();
    label.append(document.createTextNode(`☢ ${est.atoms} ${est.atoms === 1 ? "ATOM" : "ATOMS"}`));
    if (est.potential > 0) {
      label.append(document.createTextNode(" · "));
      const pot = document.createElement("span");
      pot.className = "of-nuke-tools-potential";
      pot.textContent = `+${est.potential} POTENTIAL`;
      label.appendChild(pot);
    }
    const cost = document.createElement("span");
    cost.className = "of-nuke-tools-cost";
    cost.textContent = est.potentialCost > 0
      ? `Cost: ${formatGold(est.currentCost)} + ${formatGold(est.potentialCost)} = ${formatGold(est.totalCost)} gold`
      : `Cost: ${formatGold(est.currentCost)} gold`;
    label.appendChild(cost); label.hidden = false;
    positionSamLabel(label, x, y);
  }

  function getLargestCanvas() {
    const now = performance.now();
    if (now - canvasCacheAt < 1000 && canvasCache?.isConnected) return canvasCache;
    canvasCacheAt = now; canvasCache = null;
    let largest = 0;
    for (const c of document.querySelectorAll("canvas")) {
      const r = c.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > largest) { largest = area; canvasCache = c; }
    }
    return canvasCache;
  }

  function isPointOverMap(x, y) {
    const c = getLargestCanvas();
    if (!c) return true;
    const r = c.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function getAtomBuildMenu() {
    for (const sel of ["main-radial-menu", "radial-menu", "action-menu", "build-menu", "game-menu"]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const bm = readProperty(el, "buildMenu") || readProperty(el, "uiState") ? el : null;
      if (bm) return bm;
    }
    return document.querySelector("build-menu") || document.querySelector("action-menu");
  }

  function isAtomModeSelected() {
    const bm = getAtomBuildMenu();
    const st = readProperty(bm, "uiState");
    return readProperty(st, "ghostStructure") === "Atom Bomb";
  }

  function getSamStackKey(sam) {
    const owner = getUnitOwner(sam);
    const tile = getUnitTile(sam);
    return tile === null ? "" : `${getPlayerId(owner)}:${tile}`;
  }

  function getSamRange(game, level) {
    const cfg = callMethod(game, "config") ?? readProperty(game, "config") ?? null;
    const lvl = Math.max(1, Math.floor(toFiniteNumber(level, 1)));
    const rng = toFiniteNumber(callMethod(cfg, "samRange", lvl));
    if (Number.isFinite(rng) && rng > 0) return rng;
    const max = toFiniteNumber(callMethod(cfg, "maxSamRange"), DEFAULT_MAX_SAM_RANGE);
    const safeMax = Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX_SAM_RANGE;
    return safeMax - 480 / (lvl + 5);
  }

  function collectHostileSams(game) {
    const now = performance.now();
    if (samDataCache.game === game && now - samDataCache.at < SAM_CACHE_MS) return samDataCache;
    const result = []; const seenIds = new Set(); const seenObj = new WeakSet(); let available = false;
    function add(sam) {
      if (!sam || !isActiveFinishedUnit(sam)) return;
      if (getRelationToMe(game, getUnitOwner(sam)) !== "enemy") return;
      const id = getUnitId(sam);
      if (id !== null) { if (seenIds.has(id)) return; seenIds.add(id); }
      else if (typeof sam === "object" || typeof sam === "function") { if (seenObj.has(sam)) return; seenObj.add(sam); }
      result.push(sam);
    }
    const gs = getGameUnitsCached(game, "SAM Launcher"); available ||= gs.available;
    for (const s of gs.units) add(s);
    for (const p of getPlayerViews(game)) {
      if (getRelationToMe(game, p) !== "enemy") continue;
      const ps = getPlayerUnits(p, "SAM Launcher"); available ||= ps.available;
      for (const s of ps.units) add(s);
    }
    samDataCache = { game, at: now, available, sams: result };
    return samDataCache;
  }

  function getSamEstimate(game, targetTile) {
    const col = collectHostileSams(game);
    if (!col.available) return null;
    const stacked = new Map();
    for (const s of col.sams) {
      const key = getSamStackKey(s);
      stacked.set(key, (stacked.get(key) || 0) + getUnitLevel(s));
    }
    const covering = []; const owners = new Map();
    for (const s of col.sams) {
      const tile = getUnitTile(s); if (tile === null) continue;
      const key = getSamStackKey(s);
      const range = getSamRange(game, stacked.get(key) || getUnitLevel(s));
      if (getDistanceSquared(game, tile, targetTile) > range * range) continue;
      covering.push(s);
      const own = getUnitOwner(s); if (own) owners.set(getPlayerId(own), own);
    }
    const atoms = 1 + covering.reduce((sum, s) => sum + getSamAvailableShotsNow(s), 0);
    let potential = 0;
    for (const own of owners.values()) {
      const gold = getPlayerGold(own);
      if (Number.isFinite(gold)) potential += Math.min(MAX_OWNER_POTENTIAL, Math.floor(Math.max(0, gold) / OWNER_GOLD_STEP));
    }
    const cur = atoms * ATOM_COST;
    const pot = potential * ATOM_COST;
    return { atoms, potential, currentCost: cur, potentialCost: pot, totalCost: cur + pot };
  }

  function mouseToTargetTile(game, tf, x, y) {
    let w = callMethod(tf, "screenToWorldCoordinates", x, y) || callMethod(tf, "screenToWorldCoordinates", { x, y }) || null;
    if (!w) return null;
    const wx = toFiniteNumber(readProperty(w, "x")), wy = toFiniteNumber(readProperty(w, "y"));
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
    if (callMethod(game, "isValidCoord", wx, wy) === false) return null;
    return toFiniteNumber(callMethod(game, "ref", wx, wy), null);
  }

  function clearSamSettleTimeout() {
    if (samSettleTimeout !== null) { clearTimeout(samSettleTimeout); samSettleTimeout = null; }
  }

  function calculateSamAtLastMouse() {
    samSettleTimeout = null;
    if (!settings.samCoverage || !samModeActive || lastMouseX === null || lastMouseY === null || !isPointOverMap(lastMouseX, lastMouseY)) {
      hideSamLabel(); return;
    }
    const ctx = getGameContext();
    if (!ctx?.game || typeof readProperty(ctx.transform, "screenToWorldCoordinates") !== "function") {
      renderSamTracking(lastMouseX, lastMouseY); return;
    }
    const tile = mouseToTargetTile(ctx.game, ctx.transform, lastMouseX, lastMouseY);
    if (tile === null) { hideSamLabel(); return; }
    const est = getSamEstimate(ctx.game, tile);
    if (!est) { renderSamTracking(lastMouseX, lastMouseY); return; }
    renderSamEstimate(lastMouseX, lastMouseY, est);
  }

  function scheduleSamEstimate() {
    clearSamSettleTimeout();
    if (!settings.samCoverage || !samModeActive || lastMouseX === null || lastMouseY === null) return;
    samSettleTimeout = setTimeout(calculateSamAtLastMouse, SAM_SETTLE_MS);
  }

  function handlePointerMove(e) {
    if (!settings.samCoverage || !samModeActive) return;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    hideSamLabel();
    if (isPointOverMap(lastMouseX, lastMouseY)) scheduleSamEstimate(); else clearSamSettleTimeout();
  }

  function syncSamMode() {
    const _samCtx = getGameContext();
    if (!_samCtx?.game || !isGameActive(_samCtx.game)) { hideSamLabel(); samModeActive = false; return; }
    const next = settings.samCoverage && isAtomModeSelected();
    if (next === samModeActive) return;
    samModeActive = next; clearSamSettleTimeout(); hideSamLabel();
    if (next) scheduleSamEstimate();
  }

  function setSamCoverageEnabled(on) {
    settings.samCoverage = !!on;
    if (on) {
      window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: true });
    } else {
      clearSamSettleTimeout();
      window.removeEventListener("pointermove", handlePointerMove, true);
      samModeActive = false; lastMouseX = lastMouseY = null;
      document.getElementById(SAM_LABEL_ID)?.remove();
      document.getElementById(SAM_STYLE_ID)?.remove();
    }
    ensureMasterLoop();
  }

  // === Nuke Grouper ===
  let nukeScanCache = [];
  let lastNukeScanAt = 0;
  let nukeGroupGame = null;
  let nextNukeGroupId = 1;
  const nukeEntries = new Map();
  const persistentNukeGroups = new Map();

  function ensureNukeStyle() {
    appendStyle(NUKE_STYLE_ID, `
      #${NUKE_LAYER_ID} {
        position: fixed; inset: 0; z-index: 2147483646; pointer-events: none;
      }
      #${NUKE_LAYER_ID} .of-nuke-tools-group-label {
        position: fixed; left: 0; top: 0; padding: 5px 8px 5px 20px;
        border: 1px solid var(--nuke-border); border-radius: 8px; background: rgba(7,12,18,0.9);
        color: var(--nuke-text); box-shadow: 0 4px 14px rgba(0,0,0,0.34);
        font: 900 11px/1 system-ui, sans-serif; text-shadow: 0 1px 4px rgba(0,0,0,0.92);
        white-space: nowrap; transform: translate3d(var(--nuke-x), var(--nuke-y), 0) translate(-50%, -130%);
        will-change: transform;
      }
      #${NUKE_LAYER_ID} .of-nuke-tools-group-label::before {
        content: ""; position: absolute; left: 7px; top: 50%;
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--nuke-dot); box-shadow: 0 0 8px var(--nuke-dot);
        transform: translateY(-50%);
      }
      #${NUKE_LAYER_ID} .of-nuke-tools-hbomb-count { color: var(--nuke-hbomb-text); }
    `);
  }

  function ensureNukeLayer() {
    ensureNukeStyle();
    let l = document.getElementById(NUKE_LAYER_ID);
    if (!l) {
      l = document.createElement("div");
      l.id = NUKE_LAYER_ID; l.setAttribute("aria-hidden", "true");
      (document.body || document.documentElement).appendChild(l);
    }
    return l;
  }

  function clearNukeEntries() {
    document.getElementById(NUKE_LAYER_ID)?.replaceChildren();
    nukeEntries.clear(); nukeScanCache = []; lastNukeScanAt = 0; nukeGroupGame = null; nextNukeGroupId = 1;
    persistentNukeGroups.clear();
  }

  function getNukeMagnitudeRadius(game, nukeTypeName) {
    const cfg = callMethod(game, "config") ?? readProperty(game, "config") ?? null;
    const mag = callMethod(cfg, "nukeMagnitudes", nukeTypeName);
    const r = toFiniteNumber(readProperty(mag, "outer") ?? readProperty(mag, "inner"));
    return Number.isFinite(r) && r > 0 ? r : null;
  }

  function getAtomExplosionRadius(game) { return getNukeMagnitudeRadius(game, "Atom Bomb") ?? 70; }
  function getHydrogenExplosionRadius(game) { return getNukeMagnitudeRadius(game, "Hydrogen Bomb") ?? getAtomExplosionRadius(game) * 1.8; }

  function getNukeTargetTile(game, unit) {
    return toFiniteNumber(callMethod(unit, "targetTile") ?? readProperty(readProperty(unit, "data"), "targetTile"), null);
  }

  function getRemainingImpactTicks(unit) {
    let trajectory = readProperty(unit, "trajectory");
    if (!Array.isArray(trajectory)) {
      const data = readProperty(unit, "data");
      if (data) trajectory = readProperty(data, "trajectory");
    }
    if (!Array.isArray(trajectory)) trajectory = callMethod(unit, "trajectory");

    let index = toFiniteNumber(readProperty(unit, "trajectoryIndex"), null);
    if (index === null) {
      const data = readProperty(unit, "data");
      if (data) index = toFiniteNumber(readProperty(data, "trajectoryIndex"), null);
    }
    if (index === null) index = toFiniteNumber(callMethod(unit, "trajectoryIndex"), null);

    if (!Array.isArray(trajectory) || trajectory.length === 0 || index === null) return null;
    const remaining = trajectory.length - index;
    return remaining >= 0 ? remaining : 0;
  }

  function buildNukeLabelKey(ac, hc) { return `a${ac}h${hc}`; }

  function collectNukeGroups(game) {
    if (nukeGroupGame !== game) { nukeGroupGame = game; nextNukeGroupId = 1; persistentNukeGroups.clear(); }
    const atoms = getGameUnitsCached(game, "Atom Bomb");
    const hydros = getGameUnitsCached(game, "Hydrogen Bomb");
    if (!atoms.available && !hydros.available) return [];
    const atomRad = getAtomExplosionRadius(game) * ATOM_GROUP_RADIUS_MULTIPLIER;
    const hydroRad = getHydrogenExplosionRadius(game) * ATOM_GROUP_RADIUS_MULTIPLIER;
    for (const g of persistentNukeGroups.values()) { g.atomCount = 0; g.hydrogenCount = 0; }

    function process(unit, isHydro) {
      const expType = isHydro ? "Hydrogen Bomb" : "Atom Bomb";
      if (getUnitType(unit) !== expType || !isActiveFinishedUnit(unit)) return;
      const tile = getNukeTargetTile(game, unit);
      if (tile === null) return;
      const rel = getRelationToMe(game, getUnitOwner(unit));
      if (rel !== "self" && rel !== "ally" && rel !== "enemy") return;
      const myRSq = (isHydro ? hydroRad * hydroRad : atomRad * atomRad);
      let nearest = null, nearestDist = Infinity;
      for (const g of persistentNukeGroups.values()) {
        if (g.relation !== rel) continue;
        const d = getDistanceSquared(game, g.targetTile, tile);
        const matchR = Math.max(g.ghostRadiusSquared, myRSq);
        if (d <= matchR && d < nearestDist) { nearest = g; nearestDist = d; }
      }
      if (nearest) {
        if (isHydro) nearest.hydrogenCount++; else nearest.atomCount++;
        return;
      }
      const world = tileToWorld(game, tile);
      if (!world) return;
      const group = {
        id: `group-${nextNukeGroupId++}`, relation: rel, targetTile: tile, world,
        ghostRadiusSquared: myRSq,
        atomCount: isHydro ? 0 : 1,
        hydrogenCount: isHydro ? 1 : 0,
      };
      persistentNukeGroups.set(group.id, group);
    }

    for (const u of atoms.units) process(u, false);
    for (const u of hydros.units) process(u, true);
    for (const [id, g] of persistentNukeGroups) {
      if (g.atomCount === 0 && g.hydrogenCount === 0) persistentNukeGroups.delete(id);
    }
    return Array.from(persistentNukeGroups.values());
  }

  function nukeColors(rel, hasH) {
    if (hasH) {
      if (rel === "self") return { border: "rgba(251,191,36,0.72)", text: "#fef3c7", dot: "#fbbf24", hbombText: "#fde68a" };
      if (rel === "ally") return { border: "rgba(251,191,36,0.72)", text: "#fef3c7", dot: "#fbbf24", hbombText: "#fde68a" };
      return { border: "rgba(251,113,36,0.82)", text: "#fed7aa", dot: "#fb923c", hbombText: "#fdba74" };
    }
    if (rel === "self") return { border: "rgba(96,165,250,0.58)", text: "#bfdbfe", dot: "#60a5fa", hbombText: null };
    if (rel === "ally") return { border: "rgba(74,222,128,0.54)", text: "#bbf7d0", dot: "#4ade80", hbombText: null };
    return { border: "rgba(248,113,113,0.56)", text: "#fecaca", dot: "#f87171", hbombText: null };
  }

  function nukeLabelPrefix(rel) { return rel === "self" ? "Your" : rel === "ally" ? "Ally" : "Enemy"; }

  function buildNukeLabelContent(group, colors) {
    const frag = document.createDocumentFragment();
    const pre = nukeLabelPrefix(group.relation);
    if (group.atomCount > 0 && group.hydrogenCount > 0) {
      frag.append(document.createTextNode(`${pre} ☢ x${group.atomCount} · `));
      const hs = document.createElement("span"); hs.className = "of-nuke-tools-hbomb-count";
      hs.textContent = `💣 x${group.hydrogenCount}`;
      frag.appendChild(hs);
    } else if (group.hydrogenCount > 0) {
      frag.append(document.createTextNode(`${pre} `));
      const hs = document.createElement("span"); hs.className = "of-nuke-tools-hbomb-count";
      hs.textContent = `💣 x${group.hydrogenCount}`;
      frag.appendChild(hs);
    } else {
      frag.append(document.createTextNode(`${pre} ☢ x${group.atomCount}`));
    }
    return frag;
  }

  function ensureNukeEntry(layer, group) {
    let entry = nukeEntries.get(group.id);
    if (entry) return entry;
    const label = document.createElement("div");
    label.className = "of-nuke-tools-group-label";
    layer.appendChild(label);
    const colors = nukeColors(group.relation, group.hydrogenCount > 0);
    label.style.setProperty("--nuke-border", colors.border);
    label.style.setProperty("--nuke-text", colors.text);
    label.style.setProperty("--nuke-dot", colors.dot);
    label.style.setProperty("--nuke-hbomb-text", colors.hbombText ?? colors.text);
    entry = { label, labelKey: "", hadHydrogen: group.hydrogenCount > 0, x: NaN, y: NaN, hidden: false };
    nukeEntries.set(group.id, entry);
    return entry;
  }

  function pruneNukeEntries() {
    const activeIds = new Set(nukeScanCache.map(g => g.id));
    for (const [id, entry] of nukeEntries) {
      if (!activeIds.has(id)) { entry.label.remove(); nukeEntries.delete(id); }
    }
  }

  function syncNukeGrouper() {
    if (!settings.nukeGrouper) {
      clearNukeEntries();
      document.getElementById(NUKE_LAYER_ID)?.remove();
      return;
    }
    const ctx = getGameContext();
    if (!ctx?.game || !ctx?.transform || !isGameActive(ctx.game)) {
      clearNukeEntries();
      return;
    }
    const now = performance.now();
    if (now - lastNukeScanAt >= NUKE_SCAN_MS) {
      nukeScanCache = collectNukeGroups(ctx.game);
      pruneNukeEntries();
      lastNukeScanAt = now;
    }
    const layer = ensureNukeLayer();
    for (const group of nukeScanCache) {
      const screen = worldToScreen(ctx.transform, group.world);
      const visible = Number.isFinite(screen?.x) && Number.isFinite(screen?.y) &&
        screen.x >= -100 && screen.y >= -100 && screen.x <= window.innerWidth + 100 && screen.y <= window.innerHeight + 100;
      const existing = nukeEntries.get(group.id);
      if (!visible) { if (existing && !existing.hidden) { existing.label.hidden = true; existing.hidden = true; } continue; }
      const entry = ensureNukeEntry(layer, group);
      if (entry.hidden) { entry.label.hidden = false; entry.hidden = false; }
      if (entry.x !== screen.x) { entry.label.style.setProperty("--nuke-x", `${screen.x}px`); entry.x = screen.x; }
      if (entry.y !== screen.y) { entry.label.style.setProperty("--nuke-y", `${screen.y}px`); entry.y = screen.y; }
      const nowH = group.hydrogenCount > 0;
      if (nowH !== entry.hadHydrogen) {
        const cols = nukeColors(group.relation, nowH);
        entry.label.style.setProperty("--nuke-border", cols.border);
        entry.label.style.setProperty("--nuke-text", cols.text);
        entry.label.style.setProperty("--nuke-dot", cols.dot);
        entry.label.style.setProperty("--nuke-hbomb-text", cols.hbombText ?? cols.text);
        entry.hadHydrogen = nowH;
      }
      const lk = buildNukeLabelKey(group.atomCount, group.hydrogenCount);
      if (entry.labelKey !== lk) {
        const cols = nukeColors(group.relation, nowH);
        entry.label.replaceChildren(buildNukeLabelContent(group, cols));
        entry.labelKey = lk;
      }
    }
  }

  function setNukeGrouperEnabled(on) {
    settings.nukeGrouper = !!on;
    if (!on) {
      clearNukeEntries();
      document.getElementById(NUKE_LAYER_ID)?.remove();
      document.getElementById(NUKE_STYLE_ID)?.remove();
    }
    ensureMasterLoop();
  }

  // === Teammate markers (spawn phase) ===
  let teammateAnimationFrame = null;
  let teammateScanCache = [];
  let lastTeammateScanAt = 0;

  let teammateDiagLogged = false;
  let teammateColor = "#22c55e";
  const teammateEntries = new Map();

  function ensureTeammateStyle() {
    appendStyle(TEAMMATE_STYLE_ID, `
      #${TEAMMATE_LAYER_ID} { position: fixed; inset: 0; z-index: 2147483645; pointer-events: none; }
      #${TEAMMATE_LAYER_ID} .of-nuke-tools-teammate-dot {
        position: fixed; left: 0; top: 0; width: 13px; height: 13px; margin: -6.5px 0 0 -6.5px;
        border: 2px solid rgba(255,255,255,0.72); border-radius: 50%;
        background: var(--team-color, #22c55e);
        box-shadow: 0 0 0 2px rgba(15,23,42,0.55), 0 0 10px var(--team-color, #22c55e);
        opacity: 0.86; transform: translate3d(var(--team-x), var(--team-y), 0); will-change: transform;
      }
    `);
  }

  function ensureTeammateLayer() {
    ensureTeammateStyle();
    let l = document.getElementById(TEAMMATE_LAYER_ID);
    if (!l) {
      l = document.createElement("div"); l.id = TEAMMATE_LAYER_ID; l.setAttribute("aria-hidden", "true");
      (document.body || document.documentElement).appendChild(l);
    }
    return l;
  }

  function clearTeammateEntries() {
    document.getElementById(TEAMMATE_LAYER_ID)?.remove();
    teammateEntries.clear(); teammateScanCache = []; lastTeammateScanAt = 0;
  }

  function isElementVisible(el) {
    if (!el?.isConnected) return false;
    const r = el.getBoundingClientRect?.();
    if (!r || (r.width <= 0 && r.height <= 0)) return false;
    const s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }

  // The game has renamed its spawn-phase internals across versions, so look for
  // booleans, spawn-y state strings, keys whose name mentions "spawn", and
  // finally spawn-named DOM elements. Each layer only matches real game state,
  // so false positives stay low.
  function isSpawnPhase(game) {
    const fd = callMethod(game, "frameData") ?? readProperty(game, "frameData");
    const flagKeys = ["inSpawnPhase", "isInSpawnPhase", "isSpawnPhase", "spawnPhase", "spawnActive", "isSpawning"];
    const stateKeys = ["phase", "currentPhase", "gamePhase", "phaseState", "phaseName", "state", "currentState", "gameState", "status", "mode"];

    const readFlag = (obj) => {
      if (!obj || typeof obj !== "object") return null;
      for (const k of flagKeys) {
        let v = readProperty(obj, k);
        if (typeof v === "function") v = callMethod(obj, k);
        if (typeof v === "boolean") return v;
      }
      return null;
    };
    const readState = (obj) => {
      if (!obj || typeof obj !== "object") return null;
      for (const k of stateKeys) {
        let v = readProperty(obj, k);
        if (typeof v === "function") v = callMethod(obj, k);
        if (typeof v === "string" && v.trim() && /spawn/i.test(v)) return true;
      }
      return null;
    };
    const scanKeys = (obj) => {
      if (!obj || typeof obj !== "object") return null;
      try {
        for (const k of Object.keys(obj)) {
          if (!k.toLowerCase().includes("spawn")) continue;
          let v = readProperty(obj, k);
          if (typeof v === "function") v = callMethod(obj, k);
          if (typeof v === "boolean") return v;
          if (typeof v === "string" && v.trim() && /spawn/i.test(v)) return true;
        }
      } catch (_) {}
      return null;
    };

    for (const obj of [fd, game, readProperty(game, "data")]) {
      const f = readFlag(obj);
      if (f !== null) return f;
      const s = readState(obj);
      if (s !== null) return s;
      const sc = scanKeys(obj);
      if (sc !== null) return sc;
    }

    // DOM: known spawn elements, then any visible element whose tag name
    // contains "spawn" (custom elements the game renders).
    const known = document.querySelector(
      'spawn-timer, spawn-overlay, spawn-selection, spawn-panel, spawn-view, spawn-screen, ' +
      'spawn-selection-menu, spawn-location, spawn-picker, spawn-hud, spawn-status, ' +
      'spawn-countdown, spawn-choice, spawn-menu, ' +
      '[data-game-phase="spawn"], [data-phase="spawn"], [data-phase="spawning"]'
    );
    if (isElementVisible(known)) return true;
    try {
      const all = document.querySelectorAll("*");
      for (const n of all) {
        if (typeof n.tagName !== "string" || !n.tagName.toLowerCase().includes("spawn")) continue;
        if (isElementVisible(n)) return true;
      }
    } catch (_) {}
    return false;
  }

  function isGameActive(game) {
    if (!game) return false;
    if (isSpawnPhase(game)) return false;
    const ticks = toFiniteNumber(callMethod(game, "ticks"), 0);
    if (ticks <= 0) return false;
    if (!hasKnownGameSurface()) return false;
    return true;
  }

  function getNameLocation(player) {
    const loc = callMethod(player, "nameLocation") ?? readProperty(readProperty(player, "data"), "nameLocation");
    if (loc && typeof loc === "object") {
      const x = toFiniteNumber(readProperty(loc, "x")), y = toFiniteNumber(readProperty(loc, "y"));
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
    // Fall back to position fields the game may expose directly on the player.
    for (const key of ["position", "location", "worldPos", "pos", "spawnPos", "tilePos", "namePending"]) {
      const v = callMethod(player, key) ?? readProperty(player, key);
      if (v && typeof v === "object") {
        const x = toFiniteNumber(readProperty(v, "x")), y = toFiniteNumber(readProperty(v, "y"));
        if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
      }
    }
    return null;
  }

  function hashString(value) {
    let hash = 2166136261;
    for (const c of String(value)) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  function fallbackTeamColor(team) {
    const n = String(team ?? "").trim().toLowerCase();
    if (NAMED_TEAM_COLORS[n]) return NAMED_TEAM_COLORS[n];
    const num = Number(n);
    if (Number.isInteger(num)) {
      const idx = ((num - 1) % FALLBACK_TEAM_COLORS.length + FALLBACK_TEAM_COLORS.length) % FALLBACK_TEAM_COLORS.length;
      return FALLBACK_TEAM_COLORS[idx];
    }
    return FALLBACK_TEAM_COLORS[hashString(n) % FALLBACK_TEAM_COLORS.length];
  }

  function getTeamColor(game, team) {
    const cfg = callMethod(game, "config") ?? readProperty(game, "config") ?? null;
    const theme = callMethod(cfg, "theme") ?? readProperty(cfg, "theme") ?? null;
    const col = callMethod(theme, "teamColor", String(team));
    if (typeof col === "string" && col.trim()) return col;
    const hex = callMethod(col, "toHex");
    return typeof hex === "string" && hex.trim() ? hex : fallbackTeamColor(team);
  }

  function collectTeammates(game) {
    const me = getMyPlayer(game);
    const myTeam = getPlayerTeam(me);
    if (!me || !myTeam) return [];
    teammateColor = getTeamColor(game, myTeam);
    const res = [];
    for (const p of getPlayerViews(game)) {
      if (!p || isSamePlayer(me, p) || isNationOrBot(p) || !isOnSameTeam(me, p)) continue;
      res.push({ id: getPlayerId(p), player: p });
    }
    return res;
  }

  function ensureTeammateEntry(layer, id) {
    let e = teammateEntries.get(id);
    if (e) return e;
    const m = document.createElement("div");
    m.className = "of-nuke-tools-teammate-dot";
    layer.appendChild(m);
    e = { marker: m, x: NaN, y: NaN, color: "", hidden: false };
    teammateEntries.set(id, e);
    return e;
  }

  function pruneTeammateEntries() {
    const active = new Set(teammateScanCache.map(e => e.id));
    for (const [id, entry] of teammateEntries) {
      if (!active.has(id)) { entry.marker.remove(); teammateEntries.delete(id); }
    }
  }

  function syncTeammateMarkers() {
    if (!settings.teammateMarkers) {
      clearTeammateEntries();
      teammateAnimationFrame = null;
      return;
    }

    const ctx = getGameContext();
    if (!ctx?.game || !ctx?.transform) {
      teammateAnimationFrame = requestAnimationFrame(syncTeammateMarkers);
      return;
    }

    if (!teammateDiagLogged) {
      teammateDiagLogged = true;
      let keys = "unreadable";
      let ticks = "?";
      try {
        const fd = typeof ctx.game.frameData === "function" ? ctx.game.frameData() : ctx.game.frameData;
        keys = fd && typeof fd === "object" ? Object.keys(fd).join(", ") : "none";
      } catch (_) {}
      try { ticks = typeof ctx.game.ticks === "function" ? String(ctx.game.ticks()) : "n/a"; } catch (_) {}
      console.log(
        "[Openfront+ Spawn] = isSpawnPhase:", isSpawnPhase(ctx.game),
        "isGameActive:", isGameActive(ctx.game),
        "ticks:", ticks, "| frameData keys:", keys,
      );
    }

    // Show markers whenever the game object exists but is not actively playing
    // (that is the spawn / pre-match window). This does not depend on a fragile
    // spawn-phase flag, so it survives game-version renames.
    if (isGameActive(ctx.game)) {
      clearTeammateEntries();
      teammateAnimationFrame = requestAnimationFrame(syncTeammateMarkers);
      return;
    }

    const now = performance.now();
    if (now - lastTeammateScanAt >= TEAMMATE_SCAN_MS) {
      teammateScanCache = collectTeammates(ctx.game);
      pruneTeammateEntries();
      lastTeammateScanAt = now;
    }
    const layer = ensureTeammateLayer();
    for (const { id, player } of teammateScanCache) {
      const world = getNameLocation(player);
      const screen = world ? worldToScreen(ctx.transform, world) : null;
      const visible = Number.isFinite(screen?.x) && Number.isFinite(screen?.y) &&
        screen.x >= -30 && screen.y >= -30 && screen.x <= window.innerWidth + 30 && screen.y <= window.innerHeight + 30;
      const existing = teammateEntries.get(id);
      if (!visible) { if (existing && !existing.hidden) { existing.marker.hidden = true; existing.hidden = true; } continue; }
      const entry = ensureTeammateEntry(layer, id);
      if (entry.hidden) { entry.marker.hidden = false; entry.hidden = false; }
      if (entry.color !== teammateColor) { entry.marker.style.setProperty("--team-color", teammateColor); entry.color = teammateColor; }
      if (entry.x !== screen.x) { entry.marker.style.setProperty("--team-x", `${screen.x}px`); entry.x = screen.x; }
      if (entry.y !== screen.y) { entry.marker.style.setProperty("--team-y", `${screen.y}px`); entry.y = screen.y; }
    }

    teammateAnimationFrame = requestAnimationFrame(syncTeammateMarkers);
  }

  function setTeammateMarkersEnabled(on) {
    settings.teammateMarkers = !!on;
    if (!on) {
      if (teammateAnimationFrame !== null) {
        cancelAnimationFrame(teammateAnimationFrame);
        teammateAnimationFrame = null;
      }
      clearTeammateEntries();
      document.getElementById(TEAMMATE_STYLE_ID)?.remove();
      return;
    }
    if (teammateAnimationFrame === null) {
      syncTeammateMarkers();
    }
  }

  // === Incoming nuke alert ===
  let lastAlertScanAt = 0;
  let prevAlertData = "";
  let alertPanelVisible = false;
  let currentAlertRows = [];
  let prevNukeData = new Map();
  let notificationTimeout = null;

  function ensureAlertStyle() {
    appendStyle(ALERT_STYLE_ID, `
      #${ALERT_PANEL_ID} {
        position: fixed; bottom: 16px; left: 16px; top: auto; right: auto;
        z-index: 2147483647; pointer-events: none;
        display: flex; flex-direction: column; gap: 6px;
        min-width: 220px; max-width: 300px;
      }
      .of-nuke-tools-alert-row {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
        padding: 8px 12px; border-radius: 9px; background: rgba(7,12,18,0.93);
        border: 1px solid var(--alert-border);
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        font: 12px system-ui, sans-serif; text-shadow: 0 1px 4px rgba(0,0,0,0.9);
        white-space: nowrap;
      }
      @keyframes of-nuke-tools-alert-in {
        from { opacity: 0; transform: translateX(-12px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      .of-nuke-tools-alert-dot {
        flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%;
        background: var(--alert-dot); box-shadow: 0 0 8px var(--alert-dot);
      }
      .of-nuke-tools-alert-label {
        flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 5px;
      }
      .of-nuke-tools-alert-count {
        font-size: 18px; font-weight: 900; color: var(--alert-dot); line-height: 1;
      }
      .of-nuke-tools-alert-type {
        font-size: 11px; font-weight: 700; color: var(--alert-text); line-height: 1;
      }
      .of-nuke-tools-alert-timer {
        flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end;
      }
      .of-nuke-tools-alert-timer-label {
        font-size: 8px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.08em; color: var(--alert-dot); opacity: 0.8;
      }
      .of-nuke-tools-alert-timer-value {
        font-size: 16px; font-weight: 900; color: var(--alert-timer); line-height: 1;
      }
      .of-nuke-tools-alert-sam {
        flex: 0 0 100%; margin-top: -2px; font-size: 9.5px; font-weight: 700;
        padding: 2px 6px; border-radius: 4px; text-align: center;
      }
      .of-nuke-tools-alert-sam--ok {
        background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.4); color: #86efac;
      }
      .of-nuke-tools-alert-sam--warn {
        background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.4); color: #fde68a;
      }
      .of-nuke-tools-alert-sam--danger {
        background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.4); color: #fca5a5;
      }
      .of-nuke-tools-alert-sam--unknown {
        background: rgba(100,116,139,0.12); border: 1px solid rgba(100,116,139,0.3); color: #94a3b8;
      }
      .of-nuke-tools-alert-sam--na {
        background: rgba(100,116,139,0.12); border: 1px solid rgba(100,116,139,0.3); color: #94a3b8;
      }
      .of-nuke-tools-alert-empty {
        padding: 8px 12px; border-radius: 9px; background: rgba(7,12,18,0.85);
        border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; font-size: 11px; text-align: center;
      }
      .of-nuke-tools-alert-result {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 12px; border-radius: 9px; background: rgba(7,12,18,0.93);
        border: 1px solid var(--alert-border);
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        font: 12px system-ui, sans-serif; text-shadow: 0 1px 4px rgba(0,0,0,0.9);
        white-space: nowrap;
        animation: of-nuke-tools-alert-in 150ms ease;
      }
      .of-nuke-tools-alert-result--intercepted {
        --alert-dot: #4ade80;
        --alert-text: #bbf7d0;
        --alert-border: rgba(74,222,128,0.54);
      }
      .of-nuke-tools-alert-result--landed {
        --alert-dot: #f87171;
        --alert-text: #fecaca;
        --alert-border: rgba(248,113,113,0.65);
      }
    `);
  }

  function ensureAlertPanel() {
    ensureAlertStyle();
    let p = document.getElementById(ALERT_PANEL_ID);
    if (!p) {
      p = document.createElement("div");
      p.id = ALERT_PANEL_ID;
      p.setAttribute("aria-live", "polite");
      (document.body || document.documentElement).appendChild(p);
    }
    return p;
  }

  function clearAlertPanel() {
    document.getElementById(ALERT_PANEL_ID)?.remove();
    document.getElementById(ALERT_STYLE_ID)?.remove();
    prevAlertData = "";
    currentAlertRows = [];
    prevNukeData.clear();
    if (notificationTimeout) { clearTimeout(notificationTimeout); notificationTimeout = null; }
    alertPanelVisible = false;
  }

  function alertColors(type) {
    if (type === MIRV_WARHEAD_TYPE) return { border: "rgba(244,114,182,0.7)", text: "#fbcfe8", dot: "#f472b6", timer: "#f9a8d4" };
    if (type === "Hydrogen Bomb") return { border: "rgba(251,146,60,0.7)", text: "#fed7aa", dot: "#fb923c", timer: "#fdba74" };
    if (type === "MIRV") return { border: "rgba(167,139,250,0.65)", text: "#e9d5ff", dot: "#a78bfa", timer: "#c4b5fd" };
    return { border: "rgba(248,113,113,0.65)", text: "#fecaca", dot: "#f87171", timer: "#fca5a5" };
  }

  function alertTypeLabel(type) {
    if (type === MIRV_WARHEAD_TYPE) return "💥 MIRV warheads";
    if (type === "Hydrogen Bomb") return "💣 Hydrogen";
    if (type === "MIRV") return "🚀 MIRV carrier";
    return "☢ Atom";
  }

  // ---------------- robust tile ownership ----------------
  function getTileOwner(game, tile) {
    let owner = callMethod(game, "owner", tile);
    if (owner) return owner;
    const ownerObj = readProperty(game, "owner");
    if (ownerObj && typeof ownerObj === "object") {
      const maybe = ownerObj.get ? ownerObj.get(tile) : readProperty(ownerObj, tile);
      if (maybe) return maybe;
    }
    for (const name of ["getTileOwner", "tileOwner", "getOwner", "whoOwns", "territoryOwner"]) {
      owner = callMethod(game, name, tile);
      if (owner) return owner;
    }
    const map = readProperty(game, "map");
    if (map) {
      owner = callMethod(map, "owner", tile);
      if (owner) return owner;
    }
    return null;
  }

  function isTileOwnedByPlayer(game, player, tile) {
    if (!player || tile == null) return false;
    const owner = getTileOwner(game, tile);
    if (owner) return isSamePlayer(owner, player);
    if (callMethod(player, "owns", tile) === true) return true;
    if (callMethod(player, "ownsTile", tile) === true) return true;
    if (callMethod(player, "isMyTile", tile) === true) return true;
    const arrNames = ["tiles", "ownedTiles", "territory", "myTiles", "tileList", "claimedTiles", "controlledTiles"];
    for (const arrName of arrNames) {
      const arr = callMethod(player, arrName) ?? readProperty(player, arrName);
      if (Array.isArray(arr) && arr.includes(tile)) return true;
    }
    const data = readProperty(player, "data");
    if (data) {
      for (const arrName of arrNames) {
        const arr = readProperty(data, arrName);
        if (Array.isArray(arr) && arr.includes(tile)) return true;
      }
    }
    try {
      if (typeof player === "object" && player !== null) {
        for (const key of Object.keys(player)) {
          const val = readProperty(player, key);
          if (Array.isArray(val) && val.includes(tile)) return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function getNukeTargetTileForAlert(unit) {
    let tile = toFiniteNumber(readProperty(unit, "targetTile"), null);
    if (tile !== null) return tile;
    tile = toFiniteNumber(callMethod(unit, "targetTile"), null);
    if (tile !== null) return tile;
    const target = readProperty(unit, "target");
    if (target) {
      const x = toFiniteNumber(readProperty(target, "x")), y = toFiniteNumber(readProperty(target, "y"));
    }
    return null;
  }

  // ---------- brute-force unit world position ----------
  function getUnitWorldPos(unit) {
    let x = toFiniteNumber(readProperty(unit, "x"));
    let y = toFiniteNumber(readProperty(unit, "y"));
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    const data = readProperty(unit, "data");
    if (data) {
      x = toFiniteNumber(readProperty(data, "x"));
      y = toFiniteNumber(readProperty(data, "y"));
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
    const seen = new Set();
    try {
      for (let obj = unit; obj && obj !== Object.prototype; obj = Object.getPrototypeOf(obj)) {
        const props = Object.getOwnPropertyNames(obj);
        for (const key of props) {
          if (seen.has(key)) continue;
          seen.add(key);
          try {
            const val = obj[key];
            if (val && typeof val === "object") {
              const vx = toFiniteNumber(readProperty(val, "x"));
              const vy = toFiniteNumber(readProperty(val, "y"));
              if (Number.isFinite(vx) && Number.isFinite(vy)) return { x: vx, y: vy };
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    const tile = getUnitTile(unit);
    if (tile !== null) return { tile };
    return null;
  }

  let _timerLogged = false;
  function getRemainingImpactTicksForAlert(unit, game) {
    for (const key of ["remainingTicks", "timeToImpact", "impactTimer", "eta", "ticksToImpact", "impactIn"]) {
      const val = toFiniteNumber(readProperty(unit, key), null) ?? toFiniteNumber(callMethod(unit, key), null);
      if (val !== null && val >= 0) return val;
    }

    let trajectory = readProperty(unit, "trajectory");
    if (!Array.isArray(trajectory)) {
      const data = readProperty(unit, "data");
      if (data) trajectory = readProperty(data, "trajectory");
    }
    if (!Array.isArray(trajectory)) trajectory = callMethod(unit, "trajectory");

    let index = toFiniteNumber(readProperty(unit, "trajectoryIndex"), null);
    if (index === null) {
      const data = readProperty(unit, "data");
      if (data) index = toFiniteNumber(readProperty(data, "trajectoryIndex"), null);
    }
    if (index === null) index = toFiniteNumber(callMethod(unit, "trajectoryIndex"), null);

    if (Array.isArray(trajectory) && trajectory.length > 0 && index !== null) {
      const remaining = trajectory.length - index;
      if (remaining >= 0) return remaining;
    }

    if (game) {
      const targetTile = getNukeTargetTileForAlert(unit);
      if (targetTile !== null) {
        const pos = getUnitWorldPos(unit);
        if (pos) {
          let currentX, currentY;
          if ("tile" in pos) {
            const world = tileToWorld(game, pos.tile);
            if (!world) return null;
            currentX = world.x;
            currentY = world.y;
          } else {
            currentX = pos.x;
            currentY = pos.y;
          }
          const targetX = toFiniteNumber(callMethod(game, "x", targetTile));
          const targetY = toFiniteNumber(callMethod(game, "y", targetTile));
          if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
            const dx = targetX - currentX;
            const dy = targetY - currentY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return Math.ceil(dist / NUKE_SPEED_TILES_PER_TICK);
          }
        }
      }
    }

    if (!_timerLogged) {
      _timerLogged = true;
      console.log("[NukeTimer] Could not determine ticks – dumping first nuke unit keys:");
      try {
        const keys = new Set();
        for (let o = unit; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
          Object.getOwnPropertyNames(o).forEach(k => keys.add(k));
        }
        console.log("Keys:", [...keys].sort().join(", "));
        console.log("targetTile:", readProperty(unit, "targetTile"));
        console.log("x:", readProperty(unit, "x"), "y:", readProperty(unit, "y"));
        const data = readProperty(unit, "data");
        if (data) console.log("data.x:", readProperty(data, "x"), "data.y:", readProperty(data, "y"));
      } catch (e) { console.error(e); }
    }

    return null;
  }

  // ---------- keep-playing detection ----------
  function isKeepPlayingPhase(game) {
    const frameData = callMethod(game, "frameData") ?? readProperty(game, "frameData");
    if (frameData) {
      const keep = readProperty(frameData, "inKeepPlaying");
      if (typeof keep === "boolean") return keep;
    }
    if (readProperty(game, "inKeepPlaying") === true) return true;
    if (callMethod(game, "isGameOver") === true && callMethod(game, "canKeepPlaying") === true) return true;
    return false;
  }

  // ---------- friendly SAMs for the alert ----------
  function collectFriendlySamsNearForAlert(game, targetTiles) {
    if (!Array.isArray(targetTiles) || targetTiles.length === 0) return [];

    const defenders = [];
    const seenIds = new Set();
    const seenObjects = new WeakSet();

    const onlySelf = isKeepPlayingPhase(game);

    const globalSams = getGameUnitsCached(game, "SAM Launcher");
    for (const sam of globalSams.units) {
      if (!sam || !isActiveFinishedUnit(sam)) continue;
      const owner = getUnitOwner(sam);
      const rel = getRelationToMe(game, owner);
      if (onlySelf) {
        if (rel !== "self") continue;
      } else {
        if (rel !== "self" && rel !== "ally") continue;
      }

      const uid = getUnitId(sam);
      if (uid !== null) {
        if (seenIds.has(uid)) continue;
        seenIds.add(uid);
      } else if (typeof sam === "object" || typeof sam === "function") {
        if (seenObjects.has(sam)) continue;
        seenObjects.add(sam);
      }

      const samTile = getUnitTile(sam);
      if (samTile === null) continue;
      const range = getSamRange(game, getUnitLevel(sam));
      const rangeSq = range * range;
      for (const tile of targetTiles) {
        if (getDistanceSquared(game, samTile, tile) <= rangeSq) {
          defenders.push(sam);
          break;
        }
      }
    }

    return defenders;
  }

  function computeSamDefenseForAlert(game, targetTiles, secondsUntilImpact) {
    if (secondsUntilImpact === null) return null;
    const ticksWindow = Math.max(0, secondsUntilImpact * TICKS_PER_SECOND);
    const defenders = collectFriendlySamsNearForAlert(game, targetTiles);
    if (defenders.length === 0) return { total: 0, samCount: 0, covered: 0 };
    let total = 0;
    const coveredTiles = new Set();
    for (const sam of defenders) {
      total += estimateSamShotsInWindow(game, sam, ticksWindow);
      const samTile = getUnitTile(sam);
      if (samTile === null) continue;
      const range = getSamRange(game, getUnitLevel(sam));
      const rangeSq = range * range;
      for (const tile of targetTiles) {
        if (getDistanceSquared(game, samTile, tile) <= rangeSq) coveredTiles.add(tile);
      }
    }
    return { total, samCount: defenders.length, covered: coveredTiles.size };
  }

  function collectIncomingNukes(game) {
    const me = getMyPlayer(game);
    if (!me) return [];

    const incoming = new Map();
    // "MIRV" is the carrier (cannot be intercepted). "MIRV Warhead" (the game's
    // actual unit type string) is spawned when the carrier splits — each warhead
    // is a real nuke targeting your tiles and CAN be intercepted by SAMs in
    // range, exactly like an Atom Bomb.
    const nukeTypes = ["Atom Bomb", "Hydrogen Bomb", "MIRV", MIRV_WARHEAD_TYPE];

    for (const typeName of nukeTypes) {
      const result = getGameUnitsCached(game, typeName);
      if (!result.available) continue;
      const active = result.units.filter(u => getUnitType(u) === typeName && isActiveFinishedUnit(u));

      for (const unit of active) {
        let targetTile = getNukeTargetTileForAlert(unit);
        if (targetTile === null) {
          const target = readProperty(unit, "target");
          if (target) {
            const x = toFiniteNumber(readProperty(target, "x")), y = toFiniteNumber(readProperty(target, "y"));
            if (Number.isFinite(x) && Number.isFinite(y)) {
              targetTile = toFiniteNumber(callMethod(game, "ref", x, y), null);
            }
          }
        }
        if (targetTile === null) continue;

        if (!isTileOwnedByPlayer(game, me, targetTile)) continue;

        let group = incoming.get(typeName);
        if (!group) {
          group = { count: 0, ticksArr: [], tiles: [] };
          incoming.set(typeName, group);
        }
        group.count++;
        group.tiles.push(targetTile);

        const ticksRemaining = getRemainingImpactTicksForAlert(unit, game);
        if (ticksRemaining !== null) {
          group.ticksArr.push(Math.round(ticksRemaining / TICKS_PER_SECOND));
        }
      }
    }

    const rows = [];
    for (const [typeName, group] of incoming) {
      const secs = group.ticksArr;
      const secondsMin = secs.length > 0 ? Math.min(...secs) : null;
      const secondsMax = secs.length > 0 ? Math.max(...secs) : null;

      let samStatus = null;
      if (typeName === "MIRV") {
        // Carrier: no SAM can stop it; it splits into warheads instead.
        samStatus = { carrier: true };
      } else if (group.tiles.length > 0) {
        const cap = computeSamDefenseForAlert(game, group.tiles, secondsMin);
        if (cap !== null) {
          samStatus = {
            shots: cap.total,
            samCount: cap.samCount,
            sufficient: cap.total >= group.count,
            covered: cap.covered,
          };
        } else {
          samStatus = { unknown: true };
        }
      } else {
        samStatus = { noTiles: true };
      }

      rows.push({
        nukeType: typeName,
        count: group.count,
        secondsMin,
        secondsMax,
        samStatus,
      });
    }

    rows.sort((a, b) => (a.secondsMin ?? Infinity) - (b.secondsMin ?? Infinity));
    return rows;
  }

  // ---------- alert row build / update ----------
  function createAlertRow(row) {
    const colors = alertColors(row.nukeType);
    const el = document.createElement("div");
    el.className = "of-nuke-tools-alert-row";
    el.style.setProperty("--alert-border", colors.border);
    el.style.setProperty("--alert-text", colors.text);
    el.style.setProperty("--alert-dot", colors.dot);
    el.style.setProperty("--alert-timer", colors.timer);

    const dot = document.createElement("div");
    dot.className = "of-nuke-tools-alert-dot";

    const labelEl = document.createElement("div");
    labelEl.className = "of-nuke-tools-alert-label";
    const countEl = document.createElement("span");
    countEl.className = "of-nuke-tools-alert-count";
    countEl.textContent = String(row.count);
    const typeEl = document.createElement("span");
    typeEl.className = "of-nuke-tools-alert-type";
    typeEl.textContent = alertTypeLabel(row.nukeType);
    labelEl.appendChild(countEl);
    labelEl.appendChild(typeEl);

    const timerWrap = document.createElement("div");
    timerWrap.className = "of-nuke-tools-alert-timer";
    const timerLabel = document.createElement("div");
    timerLabel.className = "of-nuke-tools-alert-timer-label";
    timerLabel.textContent = "impact";
    const timerValue = document.createElement("div");
    timerValue.className = "of-nuke-tools-alert-timer-value";
    timerWrap.appendChild(timerLabel);
    timerWrap.appendChild(timerValue);

    const samEl = document.createElement("div");
    samEl.className = "of-nuke-tools-alert-sam";

    el.appendChild(dot);
    el.appendChild(labelEl);
    el.appendChild(timerWrap);
    el.appendChild(samEl);

    updateAlertRow(el, row, timerValue, samEl);

    return { el, countEl, timerValueEl: timerValue, samEl, nukeType: row.nukeType };
  }

  function updateAlertRow(el, row, timerValueEl, samEl) {
    if (row.secondsMin !== null) {
      const lo = row.secondsMin, hi = row.secondsMax;
      timerValueEl.textContent = lo === hi || hi === null ? `${lo}s` : `${lo}–${hi}s`;
    } else {
      timerValueEl.textContent = "?s";
    }

    const samClasses = ["of-nuke-tools-alert-sam--ok", "of-nuke-tools-alert-sam--warn",
                        "of-nuke-tools-alert-sam--danger", "of-nuke-tools-alert-sam--unknown",
                        "of-nuke-tools-alert-sam--na"];
    samEl.classList.remove(...samClasses);

    if (row.nukeType === "MIRV") {
      // Carrier cannot be intercepted; the threat is the warheads it releases.
      samEl.classList.add("of-nuke-tools-alert-sam--na");
      samEl.textContent = "Carrier can't be intercepted, warheads split off (those can be)";
      return;
    }

    if (!row.samStatus) {
      samEl.classList.add("of-nuke-tools-alert-sam--unknown");
      samEl.textContent = "SAM defense unknown";
      return;
    }

    const { shots, samCount, sufficient, unknown, noTiles, covered } = row.samStatus;
    if (unknown) {
      samEl.classList.add("of-nuke-tools-alert-sam--unknown");
      samEl.textContent = "SAM defense unknown";
    } else if (noTiles) {
      samEl.classList.add("of-nuke-tools-alert-sam--unknown");
      samEl.textContent = "No target tiles";
    } else {
      if (samCount === 0) {
        samEl.classList.add("of-nuke-tools-alert-sam--danger");
        samEl.textContent = "⚠ No SAMs in range";
      } else if (sufficient) {
        samEl.classList.add("of-nuke-tools-alert-sam--ok");
        samEl.textContent = `✓ ${shots} intercept${shots !== 1 ? "s" : ""} (${samCount} SAM${samCount !== 1 ? "s" : ""})`;
      } else {
        samEl.classList.add("of-nuke-tools-alert-sam--warn");
        if (row.nukeType === MIRV_WARHEAD_TYPE) {
          const inRange = covered ?? samCount;
          samEl.textContent = `⚠ ${shots}/${row.count} intercepts · ${inRange}/${row.count} in range (${samCount} SAM${samCount !== 1 ? "s" : ""})`;
        } else {
          samEl.textContent = `⚠ ${shots}/${row.count} intercepts (${samCount} SAM${samCount !== 1 ? "s" : ""})`;
        }
      }
    }
  }

  function addNotification(panel, type, message) {
    const el = document.createElement("div");
    el.className = `of-nuke-tools-alert-result of-nuke-tools-alert-result--${type}`;
    const span = document.createElement("span");
    span.style.fontWeight = "900";
    span.style.fontSize = "14px";
    span.textContent = message;
    el.appendChild(span);
    panel.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 2500);
  }

  // True when a carrier just split into warheads instead of being intercepted
  // or landing (no "MIRV" row, but warheads present).
  function mirvSplitHappened(newData) {
    const has = (t) => newData.some(r => r.nukeType === t);
    return !has("MIRV") && has(MIRV_WARHEAD_TYPE);
  }

  function syncIncomingNukeAlert() {
    if (!settings.incomingNukeAlert) {
      clearAlertPanel();
      return;
    }

    const context = getGameContext();
    if (!context?.game || !isGameActive(context.game)) {
      if (alertPanelVisible) clearAlertPanel();
      return;
    }

    const panel = ensureAlertPanel();
    alertPanelVisible = true;

    const now = performance.now();
    if (now - lastAlertScanAt >= NUKE_SCAN_MS) {
      try {
        const newData = collectIncomingNukes(context.game);
        const structKey = JSON.stringify(newData.map(r => r.nukeType + "|" + r.count));
        const newNukeTypes = new Set(newData.map(r => r.nukeType));

        if (structKey !== prevAlertData) {
          const splitToWarheads = mirvSplitHappened(newData);
          for (const [oldType, oldData] of prevNukeData.entries()) {
            if (!newNukeTypes.has(oldType)) {
              // A MIRV carrier "disappearing" while warheads appear means it
              // split — that's not an intercept or a landing.
              if (oldType === "MIRV" && splitToWarheads) continue;
              const lastSecs = oldData.secondsMin;
              if (lastSecs !== null && lastSecs > 0) {
                addNotification(panel, "intercepted", `☢ ${alertTypeLabel(oldType)} Intercepted!`);
              } else {
                addNotification(panel, "landed", `💥 ${alertTypeLabel(oldType)} Nuke landed`);
              }
            }
          }
          prevNukeData.clear();
          for (const row of newData) {
            prevNukeData.set(row.nukeType, { secondsMin: row.secondsMin });
          }
          prevAlertData = structKey;
          panel.replaceChildren();
          currentAlertRows = [];

          if (newData.length === 0) {
            const empty = document.createElement("div");
            empty.className = "of-nuke-tools-alert-empty";
            empty.textContent = "No incoming nukes";
            panel.appendChild(empty);
          } else {
            for (const rowData of newData) {
              const rowObj = createAlertRow(rowData);
              panel.appendChild(rowObj.el);
              currentAlertRows.push(rowObj);
            }
          }
        } else {
          for (const rowData of newData) {
            prevNukeData.set(rowData.nukeType, { secondsMin: rowData.secondsMin });
          }
          if (newData.length === 0) {
            // nothing
          } else {
            for (let i = 0; i < newData.length; i++) {
              const rowData = newData[i];
              const rowObj = currentAlertRows[i];
              if (rowObj) {
                updateAlertRow(rowObj.el, rowData, rowObj.timerValueEl, rowObj.samEl);
              }
            }
          }
        }
      } catch (e) {
        console.error("[OpenFront+ Alert] Error:", e);
      }
      lastAlertScanAt = now;
    }
  }

  function setIncomingNukeAlertEnabled(on) {
    settings.incomingNukeAlert = !!on;
    if (!on) clearAlertPanel();
    ensureMasterLoop();
  }

  // === Global nuke activity ===
  let globalActivityPanelVisible = false;

  function ensureGlobalActivityStyle() {
    appendStyle(GLOBAL_ACTIVITY_STYLE_ID, `
      #${GLOBAL_ACTIVITY_PANEL_ID} {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 2147483647;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 180px;
        max-width: 260px;
      }
      .activity-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
        border-radius: 8px;
        background: rgba(7,12,18,0.88);
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font: 11px system-ui, sans-serif;
        color: #e2e8f0;
        white-space: nowrap;
      }
      .activity-count {
        font-weight: 900;
        font-size: 14px;
        color: #facc15;
        min-width: 20px;
        text-align: right;
      }
      .activity-empty {
        padding: 6px 12px;
        border-radius: 8px;
        background: rgba(7,12,18,0.85);
        border: 1px solid rgba(255,255,255,0.15);
        color: #94a3b8;
        font-size: 11px;
        text-align: center;
      }
      .personal-row {
        margin-top: 2px;
        padding: 4px 12px;
        border-radius: 8px;
        background: rgba(251,191,36,0.1);
        border: 1px solid rgba(251,191,36,0.25);
        font-size: 10px;
        color: #fde68a;
        display: flex;
        justify-content: space-between;
      }
    `);
  }

  function ensureGlobalActivityPanel() {
    ensureGlobalActivityStyle();
    let panel = document.getElementById(GLOBAL_ACTIVITY_PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = GLOBAL_ACTIVITY_PANEL_ID;
      panel.setAttribute("aria-label", "Global nuke activity");
      (document.body || document.documentElement).appendChild(panel);
    }
    return panel;
  }

  function clearGlobalActivityPanel() {
    document.getElementById(GLOBAL_ACTIVITY_PANEL_ID)?.remove();
    document.getElementById(GLOBAL_ACTIVITY_STYLE_ID)?.remove();
    globalActivityPanelVisible = false;
  }

  function getGlobalNukeCounts(game) {
    const counts = { atom: 0, hydrogen: 0, mirv: 0, warhead: 0 };
    if (!game) return counts;
    const types = [
      { id: "atom", name: "Atom Bomb" },
      { id: "hydrogen", name: "Hydrogen Bomb" },
      { id: "mirv", name: "MIRV" },
      { id: "warhead", name: MIRV_WARHEAD_TYPE }
    ];
    for (const { id, name } of types) {
      const result = getGameUnitsCached(game, name);
      if (result.available) {
        const active = result.units.filter(u => getUnitType(u) === name && isActiveFinishedUnit(u));
        counts[id] = active.length;
      }
    }
    return counts;
  }

  function getPersonalNukeCounts(game) {
    const me = getMyPlayer(game);
    if (!me) return { atom: 0, hydrogen: 0, mirv: 0, warhead: 0 };
    const counts = { atom: 0, hydrogen: 0, mirv: 0, warhead: 0 };
    const types = [
      { id: "atom", name: "Atom Bomb" },
      { id: "hydrogen", name: "Hydrogen Bomb" },
      { id: "mirv", name: "MIRV" },
      { id: "warhead", name: MIRV_WARHEAD_TYPE }
    ];
    for (const { id, name } of types) {
      const result = getGameUnitsCached(game, name);
      if (result.available) {
        const active = result.units.filter(u => {
          if (getUnitType(u) !== name || !isActiveFinishedUnit(u)) return false;
          const owner = getUnitOwner(u);
          return isSamePlayer(owner, me);
        });
        counts[id] = active.length;
      }
    }
    return counts;
  }

  function updateGlobalActivityPanel(game) {
    if (!game) {
      if (globalActivityPanelVisible) clearGlobalActivityPanel();
      return;
    }

    const panel = ensureGlobalActivityPanel();
    globalActivityPanelVisible = true;

    const globalCounts = getGlobalNukeCounts(game);
    const totalGlobal = globalCounts.atom + globalCounts.hydrogen + globalCounts.mirv + globalCounts.warhead;

    panel.replaceChildren();

    if (totalGlobal === 0) {
      const empty = document.createElement("div");
      empty.className = "activity-empty";
      empty.textContent = "No nukes in airspace";
      panel.appendChild(empty);
    } else {
      const rows = [
        ["☢ Atom", globalCounts.atom],
        ["💣 Hydro", globalCounts.hydrogen],
        ["🚀 MIRV", globalCounts.mirv],
      ];
      if (globalCounts.warhead > 0) {
        rows.push(["💥 Warheads", globalCounts.warhead]);
      }
      for (const [label, count] of rows) {
        const row = document.createElement("div");
        row.className = "activity-row";
        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        const countSpan = document.createElement("span");
        countSpan.className = "activity-count";
        countSpan.textContent = String(count);
        row.append(labelSpan, countSpan);
        panel.appendChild(row);
      }
    }

    if (settings.personalNukeTracker) {
      const personalCounts = getPersonalNukeCounts(game);
      const personalRow = document.createElement("div");
      personalRow.className = "personal-row";
      if (totalGlobal === 0) {
        personalRow.textContent = "Your nukes: 0";
      } else {
        const parts = [];
        if (personalCounts.atom > 0) parts.push(`☢ ${personalCounts.atom}`);
        if (personalCounts.hydrogen > 0) parts.push(`💣 ${personalCounts.hydrogen}`);
        if (personalCounts.mirv > 0) parts.push(`🚀 ${personalCounts.mirv}`);
        if (personalCounts.warhead > 0) parts.push(`💥 ${personalCounts.warhead}`);
        personalRow.textContent = `Your nukes: ${parts.length > 0 ? parts.join("  ") : "0"}`;
      }
      panel.appendChild(personalRow);
    }
  }

  // The global/personal counts only change when nukes launch or detonate, so
  // scanning (which calls game.units() up to 8x per pass) only needs to happen
  // twice a second instead of every frame.
  const GLOBAL_ACTIVITY_SCAN_MS = 500;
  let lastGlobalActivityScanAt = 0;

  function syncGlobalNukeActivity() {
    if (!settings.globalNukeActivity) {
      clearGlobalActivityPanel();
      return;
    }

    const context = getGameContext();
    if (!context?.game || !isGameActive(context.game)) {
      if (globalActivityPanelVisible) clearGlobalActivityPanel();
    } else {
      const now = performance.now();
      if (globalActivityPanelVisible && now - lastGlobalActivityScanAt < GLOBAL_ACTIVITY_SCAN_MS) return;
      lastGlobalActivityScanAt = now;
      updateGlobalActivityPanel(context.game);
    }
  }

  function setGlobalNukeActivityEnabled(enabled) {
    settings.globalNukeActivity = !!enabled;
    if (!settings.globalNukeActivity) clearGlobalActivityPanel();
    ensureMasterLoop();
  }

  function setPersonalNukeTrackerEnabled(enabled) {
    settings.personalNukeTracker = !!enabled;
  }

  // === Enemy silo readiness (hover overlay) ===
  // Hooks into the game's own player-info-overlay: hovering a player already
  // shows their unit counts (silos included). We add one row for how many nukes
  // are ready, where ready = silo capacity (level) minus missiles still
  // reloading — the same model the game uses for SAM launcher shots.
  let enemyNukesObservedOverlay = null;
  let enemyNukesOverlayObserver = null;
  let nukeCostCache = new Map();
  // Rescan is throttled: readiness and gold only change every few seconds, so we
  // cache the last render and re-append it when the game re-renders the overlay.
  const ENEMY_NUKES_SCAN_MS = 400;
  const ENEMY_NUKES_MIN_SCAN_GAP_MS = 100;
  let lastEnemyNukesScanAt = 0;
  let lastEnemyNukesPlayerKey = null;
  let enemyNukesRenderCache = null;

  function getSiloReadiness(u) {
    const level = toFiniteNumber(callMethod(u, "level") ?? readProperty(readProperty(u, "data"), "level"), null);
    if (level === null) return null;
    const lvl = Math.max(0, Math.round(level));
    return { level: lvl, ready: Math.max(0, lvl - getMissileTimerQueue(u).length) };
  }

  // Summed readiness across every silo owned by `player`. Null when the unit
  // API is unavailable.
  function getPlayerSiloReadiness(game, player) {
    const res = getGameUnitsCached(game, "Missile Silo");
    if (!res.available) return null;
    const st = { silos: 0, total: 0, ready: 0 };
    for (const u of res.units) {
      if (getUnitType(u) !== "Missile Silo") continue;
      const owner = getUnitOwner(u);
      if (!owner || !isSamePlayer(owner, player)) continue;
      const s = getSiloReadiness(u);
      if (s === null) continue;
      st.silos++;
      st.total += s.level;
      st.ready += s.ready;
    }
    return st;
  }

  // Current nuke costs for a player. Atom/Hydro are static; the MIRV price
  // climbs as MIRVs get launched, and the real number is what the game's build
  // menu shows (its `buildables()` worker). Falls back to the minimum until then.
  function getBuildableNukeCosts(player) {
    const now = Date.now();
    const id = getObjectId(player);
    const cached = nukeCostCache.get(id);
    if (cached && now - cached.at < NUKE_COST_REFRESH_MS) return cached;
    const fb = { ...NUKE_COST_FALLBACK, at: now };
    nukeCostCache.set(id, fb);
    const p = callMethod(player, "buildables");
    if (p && typeof p.then === "function") {
      p.then((list) => {
        if (!Array.isArray(list)) return;
        const c = { ...NUKE_COST_FALLBACK, at: Date.now() };
        for (const b of list) {
          const cost = toFiniteNumber(readProperty(b, "cost"), null);
          if (cost === null || cost <= 0) continue;
          const t = readProperty(b, "type");
          if (t === "Atom Bomb") c.atom = cost;
          else if (t === "Hydrogen Bomb") c.hydro = cost;
          else if (t === "MIRV") c.mirv = cost;
        }
        nukeCostCache.set(id, c);
      }).catch(() => {});
    }
    return fb;
  }

  // How many of each nuke type they could fire right now: the smaller of
  // their ready missiles and what their current gold can buy per type.
  function getNukeAffordability(gold, costs, ready) {
    const entries = [
      { label: "☢", cost: costs.atom },
      { label: "💣", cost: costs.hydro },
      { label: "🚀", cost: costs.mirv },
    ];
    const parts = [];
    let anyAffordable = false;
    for (const e of entries) {
      const count = e.cost > 0 ? Math.min(ready, Math.floor(gold / e.cost)) : 0;
      if (count > 0) anyAffordable = true;
      parts.push(`${e.label}${count}`);
    }
    return { parts, anyAffordable };
  }

  function enemyNukesRowClasses(state) {
    const base = "flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-700 text-xs font-bold tabular-nums";
    if (state.enemy && state.ready > 0 && !state.affordUnknown && !state.canAfford)
      return `${base} bg-amber-950/50 text-amber-300`;
    if (state.enemy && state.ready > 0)
      return `${base} bg-red-950/50 text-red-300`;
    if (state.enemy)
      return `${base} bg-slate-900/60 text-slate-400`;
    return `${base} bg-gray-900/60 text-white`;
  }

  // Adds (or updates) the readiness row inside the overlay card. The expensive
  // silo/gold scan only reruns when the hovered player changes or ~SCAN_MS
  // elapses; a cached render restores the row when the game re-renders the
  // overlay without rescanning.
  function ensureEnemyNukesHover(game, overlay) {
    const row = document.getElementById(ENEMY_NUKES_HOVER_ID);
    if (!game || !overlay) {
      row?.remove();
      lastEnemyNukesPlayerKey = null;
      enemyNukesRenderCache = null;
      return;
    }
    const player = readProperty(overlay, "player");
    if (!player) {
      row?.remove();
      lastEnemyNukesPlayerKey = null;
      enemyNukesRenderCache = null;
      return;
    }
    const card = overlay.querySelector('[class*="bg-gray-800"]');
    if (!card) {
      row?.remove();
      lastEnemyNukesPlayerKey = null;
      enemyNukesRenderCache = null;
      return;
    }

    const playerKey = getObjectId(player);
    const now = performance.now();
    // New hover rescans immediately; otherwise cap scan frequency so a
    // restlessly re-rendering overlay can never drive per-frame scans.
    const due = playerKey !== lastEnemyNukesPlayerKey
      ? now - lastEnemyNukesScanAt >= ENEMY_NUKES_MIN_SCAN_GAP_MS
      : now - lastEnemyNukesScanAt >= ENEMY_NUKES_SCAN_MS;

    if (due) {
      lastEnemyNukesScanAt = now;
      lastEnemyNukesPlayerKey = playerKey;
      const st = getPlayerSiloReadiness(game, player);
      if (!st || st.silos === 0) {
        row?.remove();
        enemyNukesRenderCache = null;
        return;
      }
      const enemy = getRelationToMe(game, player) === "enemy";
      const gold = getPlayerGold(player);
      const afford = Number.isFinite(gold)
        ? getNukeAffordability(gold, getBuildableNukeCosts(player), st.ready)
        : null;
      enemyNukesRenderCache = {
        className: enemyNukesRowClasses({
          enemy,
          ready: st.ready,
          canAfford: Boolean(afford?.anyAffordable),
          affordUnknown: afford === null,
        }),
        label: `${enemy ? "Enemy nukes ready" : "Nukes ready"}: ${st.ready} / ${st.total}`,
        affordText: afford ? afford.parts.join(" ") : "",
        title: afford ? "Max of each type they could launch right now with their current gold" : "",
      };
    }

    if (!enemyNukesRenderCache) {
      row?.remove();
      return;
    }
    if (!due && row && row.parentNode === card) return;

    let el = document.getElementById(ENEMY_NUKES_HOVER_ID);
    if (el && el.parentNode !== card) {
      el.remove();
      el = null;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = ENEMY_NUKES_HOVER_ID;
      card.appendChild(el);
    }
    const cached = enemyNukesRenderCache;
    el.className = cached.className;
    el.replaceChildren();

    const readySpan = document.createElement("span");
    readySpan.className = "flex items-center gap-1";
    readySpan.textContent = cached.label;
    el.appendChild(readySpan);

    const affordSpan = document.createElement("span");
    affordSpan.className = "flex items-center gap-1 opacity-90";
    affordSpan.textContent = cached.affordText;
    el.title = cached.title;
    el.appendChild(affordSpan);
  }

  function setupEnemyNukesObserver(game) {
    const overlay = document.querySelector("player-info-overlay");
    if (overlay === enemyNukesObservedOverlay) return;
    if (enemyNukesOverlayObserver) {
      enemyNukesOverlayObserver.disconnect();
      enemyNukesOverlayObserver = null;
    }
    enemyNukesObservedOverlay = overlay;
    if (!overlay) return;
    enemyNukesOverlayObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // Ignore changes to our own row so updating it doesn't re-trigger us.
        if (m.target && m.target.id === ENEMY_NUKES_HOVER_ID) return;
      }
      ensureEnemyNukesHover(getGameContext()?.game, overlay);
    });
    enemyNukesOverlayObserver.observe(overlay, { childList: true, subtree: true });
    ensureEnemyNukesHover(game, overlay);
  }

  function teardownEnemyNukesHover() {
    if (enemyNukesOverlayObserver) {
      enemyNukesOverlayObserver.disconnect();
      enemyNukesOverlayObserver = null;
    }
    enemyNukesObservedOverlay = null;
    nukeCostCache.clear();
    document.getElementById(ENEMY_NUKES_HOVER_ID)?.remove();
  }

  function syncEnemyNukes() {
    if (!settings.enemyNukeReadiness) {
      teardownEnemyNukesHover();
      return;
    }
    const context = getGameContext();
    if (!context?.game || !isGameActive(context.game)) {
      teardownEnemyNukesHover();
    } else {
      setupEnemyNukesObserver(context.game);
      ensureEnemyNukesHover(context.game, document.querySelector("player-info-overlay"));
    }
  }

  function setEnemyNukeReadinessEnabled(enabled) {
    settings.enemyNukeReadiness = !!enabled;
    if (!settings.enemyNukeReadiness) teardownEnemyNukesHover();
    ensureMasterLoop();
  }

  // === Trade partner rows (hover overlay) ===
  // Injects extra rows into player-info-overlay while you hover someone.
  // Income = gold you get from trading with them (their ships to your ports,
  // your ships to theirs, plus ships your warships captured from them — the
  // game pays the capturer on arrival). The other three are naval counters
  // split into "theirs" (my navy vs them) and "mine" (their navy vs me).
  // Income reuses the per-partner events the gold panel already tracks; naval
  // counts come from a throttled tracker, so these rows scan nothing extra.
  let tradePartnerObservedOverlay = null;
  let tradePartnerOverlayObserver = null;
  // Cheap path: rescan when the hover changes, otherwise reuse the last render.
  const TRADE_PARTNER_SCAN_MS = 500;
  const TRADE_PARTNER_MIN_SCAN_GAP_MS = 100;
  let lastTradePartnerScanAt = 0;
  let lastTradePartnerPlayerKey = null;
  let tradePartnerRenderCache = null;
  const TRADE_ROW_IDS = new Set([
    TRADE_PARTNER_HOVER_ID,
    TRADE_CAPTURES_HOVER_ID,
    TRADE_TRANSPORTS_HOVER_ID,
    TRADE_WARSHIPS_HOVER_ID,
  ]);

  // ---------- naval combat counters (per trade partner) ----------
  // Owner change = capture; despawn near an enemy warship = kill. Best-effort
  // heuristics that reset when you leave a game. Keyed by the OTHER party's id.
  //   capturedTheirs / theirTransportsDown / theirWarshipsDown : my navy vs them
  //   capturedMine   / myTransportsDown    / myWarshipsDown    : their navy vs me
  const NAVAL_SCAN_MS = 500;
  const TRANSPORT_KILL_RADIUS = 15;
  const WARSHIP_KILL_RADIUS = 25;
  let lastNavalScanAt = 0;
  let navalTrackers = { warships: new Map(), transports: new Map(), tradeShips: new Map() };
  let partnerNavalCounts = new Map(); // pid -> counters

  function recordNaval(pid, key) {
    if (pid === null || pid === undefined) return;
    let c = partnerNavalCounts.get(pid);
    if (!c) {
      c = { capturedTheirs: 0, capturedMine: 0, theirTransportsDown: 0, myTransportsDown: 0, theirWarshipsDown: 0, myWarshipsDown: 0 };
      partnerNavalCounts.set(pid, c);
    }
    c[key]++;
  }

  function recordAttribution(me, victimOwner, attacker, mySideKey, mySideIsVictimKey) {
    // attacker runs the navy; victim owns the unit that got captured/destroyed.
    if (isSamePlayer(attacker, me)) {
      if (victimOwner) recordNaval(getPlayerId(victimOwner), mySideKey);
    } else if (isSamePlayer(victimOwner, me)) {
      recordNaval(getPlayerId(attacker), mySideIsVictimKey);
    }
  }

  // Closest enemy warship to `tile` (ignoring `victimOwner`) within `radius`.
  function nearestWarshipOwner(game, tile, victimOwner, radius) {
    if (!Number.isFinite(tile)) return null;
    const res = getGameUnitsCached(game, WARSHIP_TYPE);
    if (!res.available) return null;
    let best = null, bestD = radius;
    for (const u of res.units) {
      const owner = getUnitOwner(u) ?? null;
      if (!owner || (victimOwner && isSamePlayer(owner, victimOwner))) continue;
      const t = getUnitTile(u);
      if (t === tile) return owner;
      const d = tileDistance(game, t, tile);
      if (d !== null && d <= bestD) { bestD = d; best = owner; }
    }
    return best;
  }

  // Accumulates per-partner naval counters, throttled. Only runs while a
  // trade-partner sub-feature is on and a game is active.
  function updateNavalEvents(game, me) {
    if (!game || !me) return;
    const now = performance.now();
    if (now - lastNavalScanAt < NAVAL_SCAN_MS) return;
    lastNavalScanAt = now;

    // Trade ships: an owner change = a warship capture.
    const tradeRes = getGameUnitsCached(game, TRADE_SHIP_TYPE);
    const tradeSeen = new Set();
    if (tradeRes.available) {
      for (const u of tradeRes.units) {
        const id = getUnitId(u);
        if (id === null) continue;
        tradeSeen.add(id);
        const owner = getUnitOwner(u) ?? null;
        if (!owner) continue;
        let t = navalTrackers.tradeShips.get(id);
        if (!t) {
          t = { firstOwner: owner, owner };
          navalTrackers.tradeShips.set(id, t);
        } else if (!t.captured && t.owner && !isSamePlayer(t.owner, owner)) {
          // owner changed => `owner` captured this ship from `t.owner`.
          t.captured = true;
          recordAttribution(me, t.owner, owner, "capturedTheirs", "capturedMine");
        }
        t.owner = owner;
      }
    }
    for (const [id] of navalTrackers.tradeShips) {
      if (!tradeSeen.has(id)) navalTrackers.tradeShips.delete(id);
    }

    // Warships: a despawn = destroyed; attribute to the nearest enemy warship.
    const warRes = getGameUnitsCached(game, WARSHIP_TYPE);
    const warSeen = new Set();
    if (warRes.available) {
      for (const u of warRes.units) {
        const id = getUnitId(u);
        if (id === null) continue;
        warSeen.add(id);
        const owner = getUnitOwner(u) ?? null;
        const tile = getUnitTile(u);
        const t = navalTrackers.warships.get(id) || { owner: null, lastTile: null };
        if (owner) t.owner = owner;
        if (tile !== null) t.lastTile = tile;
        navalTrackers.warships.set(id, t);
      }
    }
    for (const [id, t] of navalTrackers.warships) {
      if (warSeen.has(id)) continue;
      const attacker = nearestWarshipOwner(game, t.lastTile, t.owner, WARSHIP_KILL_RADIUS);
      if (attacker) recordAttribution(me, t.owner, attacker, "theirWarshipsDown", "myWarshipsDown");
      navalTrackers.warships.delete(id);
    }

    // Transport ships: a despawn away from a shoreline never unloaded troops,
    // so it was shot down — attribute to the nearest enemy warship.
    const traRes = getGameUnitsCached(game, TRANSPORT_SHIP_TYPE);
    const traSeen = new Set();
    if (traRes.available) {
      for (const u of traRes.units) {
        const id = getUnitId(u);
        if (id === null) continue;
        traSeen.add(id);
        const owner = getUnitOwner(u) ?? null;
        const tile = getUnitTile(u);
        const t = navalTrackers.transports.get(id) || { owner: null, lastTile: null };
        if (owner) t.owner = owner;
        if (tile !== null) t.lastTile = tile;
        navalTrackers.transports.set(id, t);
      }
    }
    for (const [id, t] of navalTrackers.transports) {
      if (traSeen.has(id)) continue;
      const landed =
        t.lastTile !== null &&
        callMethod(game, "isShoreline", t.lastTile) === true;
      if (!landed) {
        const attacker = nearestWarshipOwner(game, t.lastTile, t.owner, TRANSPORT_KILL_RADIUS);
        if (attacker) recordAttribution(me, t.owner, attacker, "theirTransportsDown", "myTransportsDown");
      }
      navalTrackers.transports.delete(id);
    }
  }

  // ---------- income row ----------
  function getTradePartnerStats(game, partner, me) {
    if (!game || !partner || !me) return null;
    const pid = getPlayerId(partner);
    const perSec =
      eventRate(shipIncomeEvents, pid) + eventRate(warshipIncomeEvents, pid);
    let ships = 0;
    const res = getGameUnitsCached(game, TRADE_SHIP_TYPE);
    if (res.available) {
      for (const u of res.units) {
        const owner = getUnitOwner(u) ?? null;
        if (!owner) continue;
        const dst = callMethod(u, "targetUnit") ?? null;
        const dstOwner = dst ? (getUnitOwner(dst) ?? null) : null;
        if (!dstOwner) continue;
        const mine = isSamePlayer(owner, me);
        const theirs = isSamePlayer(owner, partner);
        const dstMine = isSamePlayer(dstOwner, me);
        const dstTheirs = isSamePlayer(dstOwner, partner);
        if ((mine && dstTheirs) || (theirs && dstMine)) ships++;
      }
    }
    const blocked =
      callMethod(me, "canTrade", partner) === false ||
      callMethod(partner, "canTrade", me) === false;
    return { perSec, ships, blocked };
  }

  function tradeRowClasses(blocked, warn = false) {
    const base = "flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-700 text-xs font-bold tabular-nums";
    if (warn) return `${base} bg-red-950/50 text-red-300`;
    if (blocked) return `${base} bg-amber-950/40 text-amber-200/90`;
    return `${base} bg-slate-900/60 text-emerald-300`;
  }

  // Creates (or updates) one row element inside the overlay card.
  function ensureOverlayRow(card, id, className, title, text) {
    let el = document.getElementById(id);
    if (el && el.parentNode !== card) { el.remove(); el = null; }
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      card.appendChild(el);
    }
    el.className = className;
    el.title = title || "";
    el.replaceChildren();
    const span = document.createElement("span");
    span.className = "flex items-center gap-1";
    span.textContent = text;
    el.appendChild(span);
    return el;
  }

  function removeOverlayRow(id) {
    document.getElementById(id)?.remove();
  }

  // Pairs ("theirs" side count, "mine" side count) into a row label.
  function navalRowText(label, theirs, mine) {
    const parts = [];
    if (theirs > 0) parts.push(`theirs ${theirs}`);
    if (mine > 0) parts.push(`mine ${mine}`);
    return parts.length ? `${label}: ${parts.join(" · ")}` : `${label}: none`;
  }

  function ensureTradePartnerHover(game, overlay) {
    const removeAll = () => {
      for (const id of TRADE_ROW_IDS) removeOverlayRow(id);
      lastTradePartnerPlayerKey = null;
      tradePartnerRenderCache = null;
    };
    if (!game || !overlay) { removeAll(); return; }
    const player = readProperty(overlay, "player");
    if (!player) { removeAll(); return; }
    const card = overlay.querySelector('[class*="bg-gray-800"]');
    if (!card) { removeAll(); return; }

    const me = getMyPlayer(game);
    const playerKey = getObjectId(player);
    const pid = me ? getPlayerId(player) : null;
    const now = performance.now();
    const due = playerKey !== lastTradePartnerPlayerKey
      ? now - lastTradePartnerScanAt >= TRADE_PARTNER_MIN_SCAN_GAP_MS
      : now - lastTradePartnerScanAt >= TRADE_PARTNER_SCAN_MS;

    // Income row (expensive stats only recomputed when the hovered player
    // changes or ~TRADE_PARTNER_SCAN_MS elapses).
    if (settings.tradeIncome) {
      if (due && me) {
        lastTradePartnerScanAt = now;
        lastTradePartnerPlayerKey = playerKey;
        const st = getTradePartnerStats(game, player, me);
        if (st) {
          const rateText = st.perSec > 0 ? `+${formatGold(st.perSec)}/s` : "+0/s";
          const shipText = st.ships > 0 ? ` · ${st.ships} ship${st.ships === 1 ? "" : "s"}` : "";
          tradePartnerRenderCache = {
            className: tradeRowClasses(st.blocked),
            label: st.blocked ? `Trade: stopped` : `Trade: ${rateText}${shipText}`,
            title: st.blocked
              ? "Trading with this player is currently stopped — no gold is exchanged."
              : "Gold income you receive from trade with this player (their ships to your ports, your ships to theirs, and ships your warships captured from them).",
          };
        }
      }
      if (tradePartnerRenderCache && me) {
        ensureOverlayRow(card, TRADE_PARTNER_HOVER_ID, tradePartnerRenderCache.className, tradePartnerRenderCache.title, tradePartnerRenderCache.label);
      } else {
        removeOverlayRow(TRADE_PARTNER_HOVER_ID);
      }
    } else {
      removeOverlayRow(TRADE_PARTNER_HOVER_ID);
    }

    // Naval counters (cheap reads of the accumulated Map).
    const counts = pid ? partnerNavalCounts.get(pid) : null;
    if (settings.tradeCaptures) {
      const c = counts || { capturedTheirs: 0, capturedMine: 0 };
      const n = c.capturedTheirs + c.capturedMine;
      ensureOverlayRow(
        card, TRADE_CAPTURES_HOVER_ID, tradeRowClasses(false, n > 0),
        "Trade ships captured by warships. Theirs = your warships captured their trade ships; mine = their warships captured yours.",
        navalRowText("⚔ captures", c.capturedTheirs, c.capturedMine),
      );
    } else {
      removeOverlayRow(TRADE_CAPTURES_HOVER_ID);
    }
    if (settings.tradeTransports) {
      const c = counts || { theirTransportsDown: 0, myTransportsDown: 0 };
      const n = c.theirTransportsDown + c.myTransportsDown;
      ensureOverlayRow(
        card, TRADE_TRANSPORTS_HOVER_ID, tradeRowClasses(false, n > 0),
        "Transport ships destroyed by warships. Theirs = your warships destroyed their transports; mine = their warships destroyed yours.",
        navalRowText("🚤 transports down", c.theirTransportsDown, c.myTransportsDown),
      );
    } else {
      removeOverlayRow(TRADE_TRANSPORTS_HOVER_ID);
    }
    if (settings.tradeWarships) {
      const c = counts || { theirWarshipsDown: 0, myWarshipsDown: 0 };
      const n = c.theirWarshipsDown + c.myWarshipsDown;
      ensureOverlayRow(
        card, TRADE_WARSHIPS_HOVER_ID, tradeRowClasses(false, n > 0),
        "Warships destroyed. Theirs = you destroyed their warships; mine = they destroyed yours.",
        navalRowText("💥 warships down", c.theirWarshipsDown, c.myWarshipsDown),
      );
    } else {
      removeOverlayRow(TRADE_WARSHIPS_HOVER_ID);
    }
  }

  function setupTradePartnerObserver(game) {
    const overlay = document.querySelector("player-info-overlay");
    if (overlay === tradePartnerObservedOverlay) return;
    if (tradePartnerOverlayObserver) {
      tradePartnerOverlayObserver.disconnect();
      tradePartnerOverlayObserver = null;
    }
    tradePartnerObservedOverlay = overlay;
    if (!overlay) return;
    tradePartnerOverlayObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // Ignore changes to our own rows so updating them doesn't re-trigger us.
        if (m.target && TRADE_ROW_IDS.has(m.target.id)) return;
      }
      ensureTradePartnerHover(getGameContext()?.game, overlay);
    });
    tradePartnerOverlayObserver.observe(overlay, { childList: true, subtree: true });
    ensureTradePartnerHover(game, overlay);
  }

  function teardownTradePartnerHover() {
    if (tradePartnerOverlayObserver) {
      tradePartnerOverlayObserver.disconnect();
      tradePartnerOverlayObserver = null;
    }
    tradePartnerObservedOverlay = null;
    for (const id of TRADE_ROW_IDS) removeOverlayRow(id);
    navalTrackers = { warships: new Map(), transports: new Map(), tradeShips: new Map() };
    partnerNavalCounts = new Map();
  }

  function anyTradePartnerFeature() {
    return settings.tradeIncome || settings.tradeCaptures || settings.tradeTransports || settings.tradeWarships;
  }

  function syncTradePartnerIncome() {
    if (!anyTradePartnerFeature()) {
      teardownTradePartnerHover();
      return;
    }
    const context = getGameContext();
    if (!context?.game || !isGameActive(context.game)) {
      teardownTradePartnerHover();
    } else {
      const me = getMyPlayer(context.game);
      if (me) updateNavalEvents(context.game, me);
      setupTradePartnerObserver(context.game);
      ensureTradePartnerHover(context.game, document.querySelector("player-info-overlay"));
    }
  }

  function setTradeIncomeEnabled(enabled) {
    settings.tradeIncome = !!enabled;
    if (!anyTradePartnerFeature()) teardownTradePartnerHover();
    ensureMasterLoop();
  }

  function setTradeCapturesEnabled(enabled) {
    settings.tradeCaptures = !!enabled;
    if (!anyTradePartnerFeature()) teardownTradePartnerHover();
    ensureMasterLoop();
  }

  function setTradeTransportsEnabled(enabled) {
    settings.tradeTransports = !!enabled;
    if (!anyTradePartnerFeature()) teardownTradePartnerHover();
    ensureMasterLoop();
  }

  function setTradeWarshipsEnabled(enabled) {
    settings.tradeWarships = !!enabled;
    if (!anyTradePartnerFeature()) teardownTradePartnerHover();
    ensureMasterLoop();
  }

  // === Gold income panel (draggable) ===
  // The game is canvas-rendered, so there's nothing to hook next to the gold
  // counter — hence a draggable fixed panel (position kept in localStorage).
  //
  // The total is sampled from the player's own gold deltas (that's the number
  // to trust), then apportioned into base / ports / warships / factories from
  // source events valued with Config.tradeShipGold / Config.trainGold. A
  // tracking miss degrades the split, never the total. Warship income is its
  // own bucket (captured trade ships, paid to the capturer on arrival).
  // Conquest loot is held out via the alive-count window; negative deltas are
  // spending and ignored.

  const GOLD_PANEL_ID = "of-nuke-tools-gold-panel";
  const GOLD_POS_KEY  = "of-nuke-tools-gold-pos";
  let lastGoldSampleAt = 0;
  let goldPanel = null;
  let goldDragging = false;
  let goldDragOffsetX = 0;
  let goldDragOffsetY = 0;

  // Keep a saved panel on-screen. A drag only ever stores in-viewport coords,
  // but window/monitor size changes can still strand the panel off the visible
  // area where it's impossible to see or grab again — so clamp on load too.
  function clampPanelPos(x, y) {
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.max(4, Math.min(Math.round(x), Math.max(4, vw - 170))),
      y: Math.max(4, Math.min(Math.round(y), Math.max(4, vh - 70))),
    };
  }

  function loadGoldPanelPos() {
    try {
      const p = JSON.parse(localStorage.getItem(GOLD_POS_KEY) || "null");
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return clampPanelPos(p.x, p.y);
    } catch (_) {}
    return { x: 16, y: 100 }; // default: top-left area
  }

  function saveGoldPanelPos(x, y) {
    try { localStorage.setItem(GOLD_POS_KEY, JSON.stringify({ x, y })); } catch (_) {}
  }

  function onGoldPointerDown(e) {
    if (e.button !== 0) return;
    goldDragging = true;
    const rect = goldPanel.getBoundingClientRect();
    goldDragOffsetX = e.clientX - rect.left;
    goldDragOffsetY = e.clientY - rect.top;
    goldPanel.setPointerCapture(e.pointerId);
    goldPanel.style.opacity = "0.8";
    e.preventDefault();
  }

  function onGoldPointerMove(e) {
    if (!goldDragging || !goldPanel) return;
    const x = Math.max(4, Math.min(e.clientX - goldDragOffsetX, window.innerWidth  - goldPanel.offsetWidth  - 4));
    const y = Math.max(4, Math.min(e.clientY - goldDragOffsetY, window.innerHeight - goldPanel.offsetHeight - 4));
    goldPanel.style.left = x + "px";
    goldPanel.style.top  = y + "px";
  }

  function onGoldPointerUp(e) {
    if (!goldDragging || !goldPanel) return;
    goldDragging = false;
    goldPanel.style.opacity = "1";
    saveGoldPanelPos(parseFloat(goldPanel.style.left), parseFloat(goldPanel.style.top));
  }

  function ensureGoldIncomeStyle() {
    appendStyle(GOLD_INCOME_STYLE_ID, `
      #${GOLD_PANEL_ID} {
        position: fixed;
        z-index: 2147483647;
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: 6px 12px 5px;
        border-radius: 8px;
        background: rgba(7,12,18,0.9);
        border: 1px solid rgba(250,204,21,0.4);
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        font: 700 11px/1.5 system-ui, sans-serif;
        color: #fde047;
        text-shadow: 0 1px 3px rgba(0,0,0,0.9);
        white-space: nowrap;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      #${GOLD_PANEL_ID}:active { cursor: grabbing; }
      #${GOLD_PANEL_ID} .of-gold-hint {
        font-size: 8px;
        font-weight: 500;
        color: #475569;
        letter-spacing: 0.04em;
        margin-top: 1px;
      }
    `);
  }

  function ensureGoldPanel() {
    ensureGoldIncomeStyle();
    if (goldPanel && goldPanel.isConnected) return goldPanel;
    goldPanel = document.getElementById(GOLD_PANEL_ID);
    if (!goldPanel) {
      goldPanel = document.createElement("div");
      goldPanel.id = GOLD_PANEL_ID;
      goldPanel.addEventListener("pointerdown", onGoldPointerDown);
      goldPanel.addEventListener("pointermove", onGoldPointerMove);
      goldPanel.addEventListener("pointerup",   onGoldPointerUp);
      goldPanel.addEventListener("pointercancel", onGoldPointerUp);
      (document.body || document.documentElement).appendChild(goldPanel);
    }
    const pos = loadGoldPanelPos();
    goldPanel.style.left = pos.x + "px";
    goldPanel.style.top  = pos.y + "px";
    return goldPanel;
  }

  function clearGoldIncomeDisplay() {
    if (goldPanel) {
      goldPanel.style.display = "none";
      goldPanel.remove();
      goldPanel = null;
    }
    goldIncomePanelVisible = false;
    goldSampleHistory      = [];
    lastDisplayedRate      = null;
    lastGoldSampleAt       = 0;
    lastAliveCount         = 0;
    lootHoldUntil          = 0;
    shipIncomeEvents       = [];
    warshipIncomeEvents    = [];
    factoryIncomeEvents    = [];
    shipTrackers           = new Map();
    trainTrackers          = new Map();
    lastSourceSplitAt      = 0;
    cachedSourceSplit      = null;
  }

  // Count alive players in the current game. 0 means the view layer can't be
  // read, which just disables kill-loot exclusion (safe either way).
  function countAlivePlayers(game) {
    try {
      let alive = 0;
      for (const p of getPlayerViews(game)) {
        if (callMethod(p, "isAlive") === true) alive++;
      }
      return alive;
    } catch (_) { return 0; }
  }

  function maybeSampleGold(game) {
    const now = performance.now();
    if (now - lastGoldSampleAt < 100) return; // max once per game tick
    lastGoldSampleAt = now;
    const me = getMyPlayer(game);
    if (!me) return;
    const g = toFiniteNumber(
      callMethod(me, "gold") ?? readProperty(readProperty(me, "data"), "gold"),
      null,
    );
    if (g === null) return;
    // Conquest loot guard: eliminating someone drops the alive count the same
    // tick the gold lands. The view can lag the kill ~200ms, so on a drop we
    // flag every sample near it as possibly carrying loot.
    const alive = countAlivePlayers(game);
    if (alive > 0) {
      if (lastAliveCount > 0 && alive < lastAliveCount) {
        lootHoldUntil = Math.max(lootHoldUntil, now + GOLD_LOOT_HOLD_MS);
        for (const s of goldSampleHistory) {
          if (now - s.ts < GOLD_LOOT_HOLD_MS) s.lootHold = true;
        }
      }
      lastAliveCount = alive;
    }
    const lootHold = now < lootHoldUntil;
    goldSampleHistory.push({ gold: g, ts: now, lootHold });
    const cutoff = now - GOLD_SAMPLE_WINDOW_MS;
    while (goldSampleHistory.length > 1 && goldSampleHistory[1].ts < cutoff) {
      goldSampleHistory.shift();
    }
  }

  // Passive floor straight from Config.goldAdditionRate(): base/tick (100 human,
  // 50 bot) times goldMultiplier. Never includes ships or trains.
  function tryReadDirectIncome(game, me) {
    if (game && me) {
      const cfg = callMethod(game, "config") ?? readProperty(game, "config") ?? null;
      const rate = toFiniteNumber(callMethod(cfg, "goldAdditionRate", me), null);
      if (rate !== null && rate > 0) {
        return { perSec: rate * TICKS_PER_SECOND, perMin: rate * TICKS_PER_SECOND * 60 };
      }
      const mult = toFiniteNumber(callMethod(cfg, "goldMultiplier"), null);
      if (mult !== null && mult > 0) {
        const base = getPlayerType(me) === "BOT" ? BOT_GOLD_PER_TICK : BASE_GOLD_PER_TICK;
        const v = base * mult;
        return { perSec: v * TICKS_PER_SECOND, perMin: v * TICKS_PER_SECOND * 60 };
      }
    }
    // Try player-level income properties (fallback for minified client builds)
    for (const key of ["goldIncome", "incomePerTick", "baseIncome",
                        "goldPerTick", "income", "tickIncome", "passiveIncome"]) {
      const v = toFiniteNumber(
        callMethod(me, key) ??
        readProperty(me, key) ??
        readProperty(readProperty(me, "data"), key),
        null,
      );
      if (v !== null && v > 0) {
        return { perSec: v * TICKS_PER_SECOND, perMin: v * TICKS_PER_SECOND * 60 };
      }
    }
    return null;
  }

  // --- income split: ports / warships / factories ---
  // The sampled gross total is the source of truth; this just apportions the
  // rest into sources, so a miss degrades the split, never the total. Payouts
  // come from Config so they match the server; only the rates are measured.

  let lastSourceSplitAt = 0;
  let cachedSourceSplit = null;

  function gameConfig(game) {
    return game ? (callMethod(game, "config") ?? readProperty(game, "config") ?? null) : null;
  }

  function tileDistance(game, a, b) {
    if (!game || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    const d2 = getDistanceSquared(game, a, b);
    return Number.isFinite(d2) && d2 >= 0 ? Math.sqrt(d2) : null;
  }

  // Manhattan distance — the engine routes ships on the grid (game.manhattanDist),
  // so this tracks the real `tilesTraveled` far better than Euclidean does.
  function tileManhattan(game, a, b) {
    if (!game || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    const ax = toFiniteNumber(callMethod(game, "x", a));
    const ay = toFiniteNumber(callMethod(game, "y", a));
    const bx = toFiniteNumber(callMethod(game, "x", b));
    const by = toFiniteNumber(callMethod(game, "y", b));
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return null;
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }
  // Step between two observed positions: Manhattan if the engine gives tile
  // coords, otherwise Euclidean as a rough fallback.
  function stepLength(game, a, b) {
    const m = tileManhattan(game, a, b);
    if (m !== null && m >= 0) return m;
    return Math.max(0, tileDistance(game, a, b) ?? 0);
  }

  // Same relation buckets as the engine's `rel()` used for trainGold.
  function trainRel(a, b) {
    if (!a || !b) return "other";
    if (isSamePlayer(a, b)) return "self";
    if (callMethod(a, "isOnSameTeam", b) === true) return "team";
    if (callMethod(a, "isAlliedWith", b) === true) return "ally";
    return "other";
  }

  // Closest unit of `type` within `radius` tiles of `tile` (exact match wins).
  function findUnitNear(game, type, tile, radius) {
    if (!game || !Number.isFinite(tile)) return null;
    const res = getGameUnitsCached(game, type);
    if (!res.available) return null;
    let best = null, bestD = radius;
    for (const u of res.units) {
      const t = getUnitTile(u);
      if (t === tile) return u;
      const d = tileDistance(game, t, tile);
      if (d !== null && d <= bestD) { bestD = d; best = u; }
    }
    return best;
  }

  // Map of every City/Port station tile -> unit, built once per sample.
  function buildStationMap(game) {
    const map = new Map();
    for (const type of [CITY_TYPE, PORT_TYPE]) {
      const res = getGameUnitsCached(game, type);
      if (!res.available) continue;
      for (const u of res.units) {
        const tile = getUnitTile(u);
        if (tile !== null) map.set(tile, u);
      }
    }
    return map;
  }

  function findStationNear(game, stationMap, tile) {
    if (!Number.isFinite(tile)) return null;
    if (stationMap.has(tile)) return stationMap.get(tile);
    for (const [st, u] of stationMap) {
      const d = tileDistance(game, st, tile);
      if (d !== null && d <= TRAIN_STATION_RADIUS) return u;
    }
    return null;
  }

  function pruneIncomeEvents() {
    const cutoff = performance.now() - GOLD_SAMPLE_WINDOW_MS;
    while (shipIncomeEvents.length     && shipIncomeEvents[0].ts     < cutoff) shipIncomeEvents.shift();
    while (warshipIncomeEvents.length  && warshipIncomeEvents[0].ts  < cutoff) warshipIncomeEvents.shift();
    while (factoryIncomeEvents.length  && factoryIncomeEvents[0].ts  < cutoff) factoryIncomeEvents.shift();
  }

  // Payouts divided by the time since the oldest. Pass a `pid` to count only
  // one trade partner's events (used by the hover overlay).
  function eventRate(events, pid) {
    if (!events.length) return 0;
    const now = performance.now();
    const cutoff = now - GOLD_SAMPLE_WINDOW_MS;
    let total = 0, oldest = null;
    for (const e of events) {
      if (e.ts < cutoff) continue;
      if (pid !== undefined && e.pid !== pid) continue;
      total += e.gold;
      if (oldest === null || e.ts < oldest) oldest = e.ts;
    }
    if (oldest === null) return 0;
    const spanSec = (now - oldest) / 1000;
    return spanSec > 0 ? total / spanSec : 0;
  }

  // Trade-ship tracker. On arrival (despawn on the destination port, or seen
  // sitting on it) we award Config.tradeShipGold to whoever gets paid. Path
  // length is Manhattan steps to mirror the engine's `tilesTraveled` (the
  // client never sees the real number), floored by the straight line from first
  // sight to destination so a rarely-sampled route isn't priced as ~nothing.
  //
  // The destination comes from the ship's own `targetUnit`, so arrivals still
  // register when the last snapshot lags the despawn — that's also how captured
  // ships count: once a warship captures one it re-targets to the capturer's
  // nearest port, and on arrival the full payout goes to the capturer (the
  // current owner). Captured arrivals land in their own "warships" bucket.
  // Returns false when the unit API is unavailable.
  function updateTradeShipEvents(game, me, cfg) {
    const res = getGameUnitsCached(game, TRADE_SHIP_TYPE);
    if (!res.available) return false;
    const now = performance.now();
    const seen = new Set();
    for (const u of res.units) {
      const id = getUnitId(u);
      if (id === null) continue;
      seen.add(id);
      const tile = getUnitTile(u);
      const owner = getUnitOwner(u) ?? null;
      let t = shipTrackers.get(id);
      if (!t) {
        t = { dist: 0, lastTile: null, firstTile: tile, owner: null, firstOwner: null, seenAt: now, dstId: null, dstTile: null, dstOwner: null };
        shipTrackers.set(id, t);
      }
      if (t.lastTile !== null && tile !== null) {
        const d = stepLength(game, t.lastTile, tile);
        if (d > 0) t.dist += d;
      }
      t.lastTile = tile;
      if (owner) { if (!t.firstOwner) t.firstOwner = owner; t.owner = owner; }
      // The ship's own destination port is the ground truth for arrival.
      const dst = callMethod(u, "targetUnit") ?? null;
      if (dst) {
        const dstId = getUnitId(dst);
        const dstTile = getUnitTile(dst);
        const dstOwner = getUnitOwner(dst) ?? null;
        if (dstId !== null && dstTile !== null) {
          t.dstId = dstId;
          t.dstTile = dstTile;
          if (dstOwner) t.dstOwner = dstOwner;
        }
      }
    }
    for (const [id, t] of shipTrackers) {
      if (seen.has(id)) continue;
      // A real arrival despawns on the destination port. If it vanished with no
      // port in sight it was sunk mid-trip, which pays nothing — skip it.
      if (now - t.seenAt >= SHIP_MIN_TRACK_MS && t.lastTile !== null &&
          Number.isFinite(t.dist) && t.dist > 0) {
        let dstTile = null, dstOwner = null, dstAlive = false;
        if (t.dstTile !== null) {
          const d = tileDistance(game, t.lastTile, t.dstTile);
          if (d !== null && d <= SHIP_ARRIVE_RADIUS) {
            const p = findUnitNear(game, PORT_TYPE, t.dstTile, 0);
            dstAlive = Boolean(p && (t.dstId === null || getUnitId(p) === t.dstId));
            if (dstAlive) { dstTile = t.dstTile; dstOwner = t.dstOwner; }
          }
        }
        if (!dstAlive) {
          const p = findUnitNear(game, PORT_TYPE, t.lastTile, 3);
          if (p) { dstTile = getUnitTile(p); dstOwner = getUnitOwner(p); dstAlive = true; }
        }
        if (dstTile !== null && dstAlive) {
          // A captured ship pays only its current (capturing) owner.
          const captured = t.firstOwner && t.owner && !isSamePlayer(t.firstOwner, t.owner);
          const paysMe = captured
            ? Boolean(t.owner && isSamePlayer(t.owner, me))
            : Boolean(t.owner && isSamePlayer(t.owner, me)) ||
              Boolean(dstOwner && isSamePlayer(dstOwner, me));
          if (paysMe && cfg) {
            let dist = t.dist;
            if (t.firstTile !== null && dstTile !== null) {
              const straight = tileDistance(game, t.firstTile, dstTile);
              if (straight !== null && straight > dist) dist = straight;
            }
            const gold = toFiniteNumber(callMethod(cfg, "tradeShipGold", dist, t.owner || me), 0);
            if (gold > 0) {
              // Tag the event with the other party so the hover overlay can sum
              // per-partner income: original owner if captured, otherwise the
              // ship's owner if we're the destination, else the port owner.
              const partner = captured
                ? t.firstOwner
                : (t.owner && isSamePlayer(t.owner, me) ? dstOwner : t.owner);
              const pid = partner ? getPlayerId(partner) : null;
              (captured ? warshipIncomeEvents : shipIncomeEvents).push({ gold, ts: now, pid });
            }
          }
        }
      }
      shipTrackers.delete(id);
    }
    return true;
  }

  // Train tracker. Each City/Port stop pays Config.trainGold to the train and/or
  // station owner. The stop counter is re-derived per engine — the engine-side
  // `_tradeStopsVisited` isn't visible to the client.
  function updateTrainEvents(game, me, cfg) {
    const res = getGameUnitsCached(game, TRAIN_TYPE);
    if (!res.available) return false;
    const now = performance.now();
    const seen = new Set();
    const engines = [];
    for (const u of res.units) {
      const id = getUnitId(u);
      if (id === null) continue;
      seen.add(id);
      const ttype = callMethod(u, "trainType");
      // The engine drives the train; carriages just follow. Some builds don't
      // expose trainType, so unknown units count as engines.
      if (ttype !== undefined && ttype !== null && ttype !== TRAIN_ENGINE_TYPE) continue;
      const tile = getUnitTile(u);
      const owner = getUnitOwner(u) ?? null;
      const t = trainTrackers.get(id) || { stops: 0, lastStopKey: null, lastTile: null, owner: null };
      if (tile !== null && t.lastTile !== tile) t.lastTile = tile;
      if (owner) t.owner = owner;
      trainTrackers.set(id, t);
      engines.push({ tile, t });
    }
    if (engines.length === 0) return true;
    if (engines.length < 200) {
      const stationMap = buildStationMap(game);
      if (stationMap.size > 0 && stationMap.size <= 2000) {
        const stationStopsThisSample = new Set();
        for (const e of engines) {
          const st = findStationNear(game, stationMap, e.tile);
          if (!st) { e.t.lastStopKey = null; continue; }
          const key = getUnitId(st);
          if (key === null || key === e.t.lastStopKey) continue;
          // One payout per station per sample, or the engine + its carriages (or two
          // trains) would double-count the same stop.
          if (stationStopsThisSample.has(key)) continue;
          stationStopsThisSample.add(key);
          e.t.lastStopKey = key;
          const stationOwner = getUnitOwner(st) ?? null;
          const rel = trainRel(e.t.owner, stationOwner);
          const stops = e.t.stops; // before increment, matching the engine
          const same = e.t.owner && stationOwner && isSamePlayer(e.t.owner, stationOwner);
          const paysMeTrain   = Boolean(e.t.owner && isSamePlayer(e.t.owner, me));
          const paysMeStation = Boolean(stationOwner && isSamePlayer(stationOwner, me)) && !same;
          if ((paysMeTrain || paysMeStation) && cfg) {
            // A station owner is paid using the TRAIN owner's gold multiplier.
            const goldFor = paysMeTrain ? me : e.t.owner;
            const gold = toFiniteNumber(callMethod(cfg, "trainGold", rel, stops, goldFor), 0);
            if (gold > 0) factoryIncomeEvents.push({ gold, ts: now });
          }
          e.t.stops++;
        }
      }
    }
    for (const [id, t] of trainTrackers) {
      if (!seen.has(id)) trainTrackers.delete(id);
    }
    return true;
  }

  // Per-source split from detected events, gold/sec. Null when the unit API is
  // unavailable and the caller falls back to the combined number.
  function measureSourceSplit(game, me) {
    const now = performance.now();
    if (cachedSourceSplit && now - lastSourceSplitAt < 350) return cachedSourceSplit;
    lastSourceSplitAt = now;
    try {
      const cfg = gameConfig(game);
      const shipAvail  = updateTradeShipEvents(game, me, cfg);
      const trainAvail = updateTrainEvents(game, me, cfg);
      if (!shipAvail || !trainAvail) { cachedSourceSplit = null; return null; }
      pruneIncomeEvents();
      const base = cfg ? toFiniteNumber(callMethod(cfg, "goldAdditionRate", me), null) : null;
      const basePerSec = base !== null && base > 0 ? base * TICKS_PER_SECOND : 0;
      const portsPerSec     = eventRate(shipIncomeEvents);
      const warshipsPerSec  = eventRate(warshipIncomeEvents);
      const factoriesPerSec = eventRate(factoryIncomeEvents);
      cachedSourceSplit = { basePerSec, ports: portsPerSec, warships: warshipsPerSec, factories: factoriesPerSec };
      return cachedSourceSplit;
    } catch (_) {
      cachedSourceSplit = null;
      return null;
    }
  }

  // Gross rate: average of positive gold gains over the window (base + ports +
  // factories). `lootHold` steps are conquest loot and get skipped; negative
  // deltas are spending and ignored.
  function computeGoldGrossRate() {
    if (goldSampleHistory.length < 15) return null;
    const first = goldSampleHistory[0];
    const last  = goldSampleHistory[goldSampleHistory.length - 1];
    const elapsedSec = (last.ts - first.ts) / 1000;
    if (elapsedSec < 2) return null;
    let totalGain = 0;
    let steps = 0;
    for (let i = 1; i < goldSampleHistory.length; i++) {
      // Skip steps that may contain conquest loot (alive count dropped then).
      if (goldSampleHistory[i].lootHold) continue;
      const dg = goldSampleHistory[i].gold - goldSampleHistory[i - 1].gold;
      if (dg > 0) { totalGain += dg; steps++; }
    }
    if (steps < 8) return null;
    const grossPerSec = totalGain / elapsedSec;
    return { perSec: grossPerSec, perMin: grossPerSec * 60 };
  }

  function computeGoldRates(game) {
    // Sampled gross is the trustworthy total; the split only apportions it, so
    // a tracking miss never drops the number — worst case the label degrades.
    const me = getMyPlayer(game);
    const gross = computeGoldGrossRate();
    const split = me ? measureSourceSplit(game, me) : null;
    if (split) {
      const basePerSec = split.basePerSec;
      let ports = split.ports, warships = split.warships, factories = split.factories;
      if (gross && gross.perSec > basePerSec) {
        const extra = gross.perSec - basePerSec;
        const sum = ports + warships + factories;
        if (sum > 0) { const scale = extra / sum; ports *= scale; warships *= scale; factories *= scale; }
      }
      const totalPerSec = gross ? gross.perSec : basePerSec + ports + warships + factories;
      return {
        perSec: totalPerSec,
        perMin: totalPerSec * 60,
        base: basePerSec > 0 ? { perSec: basePerSec, perMin: basePerSec * 60 } : null,
        ports,
        warships,
        factories,
        source: "split",
      };
    }
    if (!gross) return null;
    const base = me ? tryReadDirectIncome(game, me) : null;
    return { perSec: gross.perSec, perMin: gross.perMin, base, ports: null, warships: null, factories: null, source: "combined" };
  }

  function updateGoldIncomeDisplay(game) {
    if (!settings.goldPerSecond && !settings.goldPerMinute) {
      clearGoldIncomeDisplay();
      return;
    }
    maybeSampleGold(game);
    const me = getMyPlayer(game);
    const rates = computeGoldRates(game) ?? (me ? tryReadDirectIncome(game, me) : null);
    const lines = [];
    if (rates) {
      if (settings.goldPerSecond) lines.push(`+${formatGold(rates.perSec)}/s`);
      if (settings.goldPerMinute) lines.push(`+${formatGold(rates.perMin)}/min`);
      if (rates.source === "split") {
        const parts = [];
        if (rates.base && rates.base.perSec > 0) parts.push(`+${formatGold(rates.base.perSec)}/s base`);
        if (rates.ports > 0) parts.push(`+${formatGold(rates.ports)}/s ports`);
        if (rates.warships > 0) parts.push(`+${formatGold(rates.warships)}/s warships`);
        if (rates.factories > 0) parts.push(`+${formatGold(rates.factories)}/s factories`);
        if (parts.length > 1) lines.push(parts.join(" · "));
      } else {
        const base = rates.base?.perSec;
        if (Number.isFinite(base) && base > 0 && rates.perSec > base * 1.05) {
          lines.push(`+${formatGold(base)}/s base · +${formatGold(rates.perSec - base)}/s ports/factories`);
        }
      }
    } else {
      lines.push("💰 Sampling…");
    }

    const panel = ensureGoldPanel();
    panel.style.display = "flex";
    panel.textContent = "";
    for (const line of lines) {
      const s = document.createElement("span");
      s.textContent = line;
      panel.appendChild(s);
    }
    const hasDragged = (() => {
      try { return localStorage.getItem(GOLD_POS_KEY) !== null; } catch (_) { return false; }
    })();
    if (!hasDragged) {
      const hint = document.createElement("div");
      hint.className = "of-gold-hint";
      hint.textContent = "drag to move";
      panel.appendChild(hint);
    }
    goldIncomePanelVisible = true;
  }

  function syncGoldIncome() {
    if (!settings.goldPerSecond && !settings.goldPerMinute) {
      clearGoldIncomeDisplay();
      return;
    }
    const context = getGameContext();
    if (!context?.game || !isGameActive(context.game)) {
      if (goldIncomePanelVisible) clearGoldIncomeDisplay();
    } else {
      updateGoldIncomeDisplay(context.game);
    }
  }


  // === Troop rate panel ===
  // Primary source is Config.troopIncreaseRate(), so the number matches the
  // server. Cap comes from Config.maxTroops — more/upgraded cities raise it and
  // growth with it. Natural growth only; attacking is never counted. Falls back
  // to a median of positive deltas over 30s if the config object can't be read.

  const TROOP_PANEL_ID = "of-nuke-tools-troop-panel";
  const TROOP_POS_KEY  = "of-nuke-tools-troop-pos";
  const TROOP_STYLE_ID = "of-nuke-tools-troop-style";
  let lastTroopSampleAt = 0;
  let troopPanel = null;
  let troopDragging = false;
  let troopDragOffsetX = 0;
  let troopDragOffsetY = 0;

  function onTroopPointerDown(e) {
    if (e.button !== 0) return;
    troopDragging = true;
    const rect = troopPanel.getBoundingClientRect();
    troopDragOffsetX = e.clientX - rect.left;
    troopDragOffsetY = e.clientY - rect.top;
    troopPanel.setPointerCapture(e.pointerId);
    troopPanel.style.opacity = "0.8";
    e.preventDefault();
  }

  function onTroopPointerMove(e) {
    if (!troopDragging || !troopPanel) return;
    const x = Math.max(4, Math.min(e.clientX - troopDragOffsetX, window.innerWidth  - troopPanel.offsetWidth  - 4));
    const y = Math.max(4, Math.min(e.clientY - troopDragOffsetY, window.innerHeight - troopPanel.offsetHeight - 4));
    troopPanel.style.left = x + "px";
    troopPanel.style.top  = y + "px";
  }

  function onTroopPointerUp(e) {
    if (!troopDragging || !troopPanel) return;
    troopDragging = false;
    troopPanel.style.opacity = "1";
    try { localStorage.setItem(TROOP_POS_KEY, JSON.stringify({
      x: parseFloat(troopPanel.style.left),
      y: parseFloat(troopPanel.style.top),
    })); } catch (_) {}
  }

  function ensureTroopStyle() {
    appendStyle(TROOP_STYLE_ID, `
      #${TROOP_PANEL_ID} {
        position: fixed;
        z-index: 2147483647;
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: 6px 12px 5px;
        border-radius: 8px;
        background: rgba(7,12,18,0.9);
        border: 1px solid rgba(74,222,128,0.4);
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        font: 700 11px/1.5 system-ui, sans-serif;
        color: #86efac;
        text-shadow: 0 1px 3px rgba(0,0,0,0.9);
        white-space: nowrap;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      #${TROOP_PANEL_ID}:active { cursor: grabbing; }
      #${TROOP_PANEL_ID} .of-troop-hint {
        font-size: 8px;
        font-weight: 500;
        color: #475569;
        letter-spacing: 0.04em;
        margin-top: 1px;
        pointer-events: none;
      }
    `);
  }

  function ensureTroopPanel() {
    ensureTroopStyle();
    if (troopPanel && troopPanel.isConnected) return troopPanel;
    troopPanel = document.getElementById(TROOP_PANEL_ID);
    if (!troopPanel) {
      troopPanel = document.createElement("div");
      troopPanel.id = TROOP_PANEL_ID;
      troopPanel.addEventListener("pointerdown", onTroopPointerDown);
      troopPanel.addEventListener("pointermove", onTroopPointerMove);
      troopPanel.addEventListener("pointerup",   onTroopPointerUp);
      troopPanel.addEventListener("pointercancel", onTroopPointerUp);
      (document.body || document.documentElement).appendChild(troopPanel);
    }
    try {
      const pos = JSON.parse(localStorage.getItem(TROOP_POS_KEY) || "null");
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        const c = clampPanelPos(pos.x, pos.y);
        troopPanel.style.left = c.x + "px";
        troopPanel.style.top  = c.y + "px";
      } else {
        troopPanel.style.left = "16px";
        troopPanel.style.top  = "160px"; // default below gold panel
      }
    } catch (_) {
      troopPanel.style.left = "16px";
      troopPanel.style.top  = "160px";
    }
    return troopPanel;
  }

  function clearTroopRateDisplay() {
    if (troopPanel) {
      troopPanel.style.display = "none";
      troopPanel.remove();
      troopPanel = null;
    }
    troopRatePanelVisible = false;
    troopSampleHistory = [];
    lastTroopSampleAt = 0;
  }

  function maybeSampleTroops(game) {
    const now = performance.now();
    if (now - lastTroopSampleAt < 100) return;
    lastTroopSampleAt = now;
    const me = getMyPlayer(game);
    if (!me) return;
    const t = toFiniteNumber(
      callMethod(me, "troops") ??
      readProperty(me, "troops") ??
      readProperty(readProperty(me, "data"), "troops"),
      null,
    );
    if (t === null) return;
    troopSampleHistory.push({ troops: t, ts: now });
    const cutoff = now - 30000;
    while (troopSampleHistory.length > 1 && troopSampleHistory[1].ts < cutoff) {
      troopSampleHistory.shift();
    }
  }

  // Exact growth rate. Config.troopIncreaseRate(player) is the server's own
  // (10 + troops^0.73/4) * (1 - troops/maxTroops) with city-aware cap and
  // bot/nation multipliers — so it's pure natural growth, never combat.
  function computeTroopRateFromFormula(game, me) {
    if (!game || !me) return null;
    try {
      const cfg = callMethod(game, "config") ?? readProperty(game, "config") ?? null;
      if (!cfg) return null;
      const exact = toFiniteNumber(callMethod(cfg, "troopIncreaseRate", me), null);
      if (exact !== null && exact >= 0) {
        // The HUD labels the per-tick value as "+X/s", so match that exactly.
        const perSec = exact;
        return { perSec, perMin: perSec * 60, source: "formula" };
      }
      // Fallback: reimplement using Config.maxTroops (which is city-aware).
      const troops = toFiniteNumber(
        callMethod(me, "troops") ?? readProperty(me, "troops") ?? readProperty(readProperty(me, "data"), "troops"),
        null,
      );
      if (troops === null || troops < 0) return null;
      const max = toFiniteNumber(callMethod(cfg, "maxTroops", me), null);
      if (!Number.isFinite(max) || max <= 0) return null;
      let toAdd = 10 + Math.pow(troops, 0.73) / 4;
      toAdd *= 1 - troops / max;
      if (getPlayerType(me) === "BOT") toAdd *= 0.5;
      toAdd = Math.max(0, Math.min(toAdd, max - troops));
      if (!Number.isFinite(toAdd)) return null;
      // Same convention: per-tick value displayed as "/s".
      const perSec = toAdd;
      return { perSec, perMin: perSec * 60, source: "formula" };
    } catch (_) { return null; }
  }

  function computeTroopRates(game, me) {
    const formula = computeTroopRateFromFormula(game, me);
    if (formula) return formula;
    if (troopSampleHistory.length < 15) return null;
    const first = troopSampleHistory[0];
    const last  = troopSampleHistory[troopSampleHistory.length - 1];
    const elapsedSec = (last.ts - first.ts) / 1000;
    if (elapsedSec < 2) return null;
    // Median of positive step rates; negatives are combat losses, and the
    // median shrugs off worker-burst outliers.
    const stepRates = [];
    for (let i = 1; i < troopSampleHistory.length; i++) {
      const dt = troopSampleHistory[i].troops - troopSampleHistory[i - 1].troops;
      const ds = (troopSampleHistory[i].ts    - troopSampleHistory[i - 1].ts) / 1000;
      if (dt > 0 && ds > 0) stepRates.push(dt / ds);
    }
    if (stepRates.length < 8) return null;
    stepRates.sort((a, b) => a - b);
    const mid = Math.floor(stepRates.length / 2);
    const median = stepRates.length % 2 === 0
      ? (stepRates[mid - 1] + stepRates[mid]) / 2
      : stepRates[mid];
    // Measured is real troops/sec; the game labels the per-tick value as "/s",
    // so divide by 10 to match its figure.
    return { perSec: median / 10, perMin: (median / 10) * 60, source: "sample" };
  }

  function formatTroops(value) {
    const n = Math.max(0, Math.round(value));
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
  }

  function updateTroopRateDisplay(game) {
    if (!settings.troopPerSecond && !settings.troopPerMinute) {
      clearTroopRateDisplay();
      return;
    }
    maybeSampleTroops(game);
    const rates = computeTroopRates(game, getMyPlayer(game));
    const lines = [];
    if (rates) {
      if (settings.troopPerSecond) lines.push(`+${formatTroops(rates.perSec)}/s`);
      if (settings.troopPerMinute) lines.push(`+${formatTroops(rates.perMin)}/min`);
    } else {
      lines.push("⚔ Sampling…");
    }

    const panel = ensureTroopPanel();
    panel.style.display = "flex";
    panel.textContent = "";
    for (const line of lines) {
      const s = document.createElement("span");
      s.textContent = line;
      panel.appendChild(s);
    }
    // Show drag hint until first drag
    const hasDragged = (() => {
      try { return localStorage.getItem(TROOP_POS_KEY) !== null; } catch (_) { return false; }
    })();
    if (!hasDragged) {
      const hint = document.createElement("div");
      hint.className = "of-troop-hint";
      hint.textContent = "drag to move";
      panel.appendChild(hint);
    }
    troopRatePanelVisible = true;
  }

  function syncTroopRate() {
    if (!settings.troopPerSecond && !settings.troopPerMinute) {
      clearTroopRateDisplay();
      return;
    }
    const context = getGameContext();
    if (!context?.game || !isGameActive(context.game)) {
      if (troopRatePanelVisible) clearTroopRateDisplay();
    } else {
      updateTroopRateDisplay(context.game);
    }
  }

  function setTroopRateEnabled(on) {
    settings.troopPerSecond = on ? settings.troopPerSecond : false;
    settings.troopPerMinute = on ? settings.troopPerMinute : false;
    if (!on) clearTroopRateDisplay();
    ensureMasterLoop();
  }

  // === Master loop ===
  // All features run from a single requestAnimationFrame callback instead of a
  // loop each. Idle (lobby) does no feature work and just ticks slowly to notice
  // a match starting; with nothing enabled the loop doesn't run at all, so the
  // extension costs ~nothing when everything is switched off.
  let masterLoopRunning = false;
  let masterLoopFrame = null;
  let masterWasInGame = false;
  let lastMasterRunAt = 0;
  let lastSamModePollAt = 0;
  // We don't need 60fps for numbers that change slowly — cap feature work at
  // ~30fps. The heavy scans are throttled per feature on top of this.
  const MASTER_WORK_MS = 33;
  let lastMasterWorkAt = 0;

  function anyFeatureEnabled() {
    return settings.samCoverage || settings.nukeGrouper || settings.teammateMarkers ||
      settings.incomingNukeAlert || settings.globalNukeActivity || settings.enemyNukeReadiness ||
      settings.tradeIncome || settings.tradeCaptures || settings.tradeTransports || settings.tradeWarships ||
      settings.goldPerSecond || settings.goldPerMinute || settings.troopPerSecond || settings.troopPerMinute;
  }

  function teardownAllInGameFeatures() {
    clearSamSettleTimeout();
    hideSamLabel();
    samModeActive = false;
    clearNukeEntries();
    document.getElementById(NUKE_LAYER_ID)?.remove();
    clearTeammateEntries();
    if (alertPanelVisible) clearAlertPanel();
    if (globalActivityPanelVisible) clearGlobalActivityPanel();
    teardownEnemyNukesHover();
    teardownTradePartnerHover();
    if (goldIncomePanelVisible) clearGoldIncomeDisplay();
    if (troopRatePanelVisible) clearTroopRateDisplay();
  }

  function runMasterLoop() {
    if (!anyFeatureEnabled()) {
      masterLoopRunning = false;
      masterLoopFrame = null;
      masterWasInGame = false;
      return;
    }
    const now = performance.now();
    // Idle: tick slowly so we notice a match starting, but cost ~nothing.
    if (!masterWasInGame && now - lastMasterRunAt < 500) {
      masterLoopFrame = requestAnimationFrame(runMasterLoop);
      return;
    }
    lastMasterRunAt = now;

    const context = getGameContext();
    const inGame = Boolean(context?.game && isGameActive(context.game));
    if (!inGame) {
      if (masterWasInGame) {
        teardownAllInGameFeatures();
        masterWasInGame = false;
      }
      // Teammate markers run in their own requestAnimationFrame loop (they are
      // a spawn-phase feature and isGameActive() is false during spawn), so the
      // master loop doesn't drive them.
      masterLoopFrame = requestAnimationFrame(runMasterLoop);
      return;
    }
    masterWasInGame = true;

    if (now - lastMasterWorkAt < MASTER_WORK_MS) {
      masterLoopFrame = requestAnimationFrame(runMasterLoop);
      return;
    }
    lastMasterWorkAt = now;

    if (settings.samCoverage && now - lastSamModePollAt >= SAM_MODE_POLL_MS) {
      lastSamModePollAt = now;
      syncSamMode();
    }
    if (settings.nukeGrouper) syncNukeGrouper();
    if (settings.incomingNukeAlert) syncIncomingNukeAlert();
    if (settings.globalNukeActivity) syncGlobalNukeActivity();
    if (settings.enemyNukeReadiness) syncEnemyNukes();
    if (settings.tradeIncome || settings.tradeCaptures || settings.tradeTransports || settings.tradeWarships) syncTradePartnerIncome();
    if (settings.goldPerSecond || settings.goldPerMinute) syncGoldIncome();
    if (settings.troopPerSecond || settings.troopPerMinute) syncTroopRate();

    masterLoopFrame = requestAnimationFrame(runMasterLoop);
  }

  function ensureMasterLoop() {
    if (!masterLoopRunning && anyFeatureEnabled()) {
      masterLoopRunning = true;
      masterLoopFrame = requestAnimationFrame(runMasterLoop);
    }
  }

  function stopMasterLoop() {
    if (masterLoopFrame !== null) {
      cancelAnimationFrame(masterLoopFrame);
      masterLoopFrame = null;
    }
    masterLoopRunning = false;
    masterWasInGame = false;
  }

  // ==================== Settings & lifecycle ====================
  function applySettings(value) {
    const src = value && typeof value === "object" ? value : {};
    setSamCoverageEnabled(Boolean(src.samCoverage));
    setNukeGrouperEnabled(Boolean(src.nukeGrouper));
    setTeammateMarkersEnabled(Boolean(src.teammateMarkers));
    setIncomingNukeAlertEnabled(Boolean(src.incomingNukeAlert));
    setGlobalNukeActivityEnabled(Boolean(src.globalNukeActivity));
    setPersonalNukeTrackerEnabled(Boolean(src.personalNukeTracker));
    setEnemyNukeReadinessEnabled(Boolean(src.enemyNukeReadiness));
    setTradeIncomeEnabled(Boolean(src.tradeIncome));
    setTradeCapturesEnabled(Boolean(src.tradeCaptures));
    setTradeTransportsEnabled(Boolean(src.tradeTransports));
    setTradeWarshipsEnabled(Boolean(src.tradeWarships));

    const oldGoldActive = settings.goldPerSecond || settings.goldPerMinute;
    settings.goldPerSecond = Boolean(src.goldPerSecond);
    settings.goldPerMinute = Boolean(src.goldPerMinute);
    if (oldGoldActive && !(settings.goldPerSecond || settings.goldPerMinute)) clearGoldIncomeDisplay();

    const oldTroopActive = settings.troopPerSecond || settings.troopPerMinute;
    settings.troopPerSecond = Boolean(src.troopPerSecond);
    settings.troopPerMinute = Boolean(src.troopPerMinute);
    if (oldTroopActive && !(settings.troopPerSecond || settings.troopPerMinute)) clearTroopRateDisplay();

    ensureMasterLoop();
  }

  function stopAllFeatures() {
    setSamCoverageEnabled(false);
    setNukeGrouperEnabled(false);
    setTeammateMarkersEnabled(false);
    setIncomingNukeAlertEnabled(false);
    setGlobalNukeActivityEnabled(false);
    setPersonalNukeTrackerEnabled(false);
    setEnemyNukeReadinessEnabled(false);
    setTradeIncomeEnabled(false);
    setTradeCapturesEnabled(false);
    setTradeTransportsEnabled(false);
    setTradeWarshipsEnabled(false);
    settings.goldPerSecond = false;
    settings.goldPerMinute = false;
    settings.troopPerSecond = false;
    settings.troopPerMinute = false;
    teardownAllInGameFeatures();
    stopMasterLoop();
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.source !== EXTENSION_SOURCE || data.type !== "SETTINGS") return;
    applySettings(data.payload);
  });

  window.addEventListener("pagehide", stopAllFeatures, { once: true });

  window.postMessage({ source: PAGE_SOURCE, type: "READY" }, "*");
})();