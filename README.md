# Openfront+

A clean, separate **Manifest V3** browser extension for Google Chrome that adds
quality-of-life overlays and readouts to the browser game
[OpenFront.io](https://openfront.io).

Everything runs locally: the extension only reads what the game page already
exposes and draws on top of it. No accounts, no network calls, no data leaves
your browser, and it provides **no advantages or cheats** — it just makes
information the game already has easier to see.

There are ten toggles in the popup, grouped into feature cards. Cards marked
with an arrow are collapsible and hold sub-toggles.

## Features

### 1. SAM Coverage

While the **Atom Bomb** tool is selected (`ghostStructure === "Atom Bomb"`,
normally set by pressing `8`), rests your cursor over a tile for 1.5 seconds and
then shows:

- how many atoms you need (1 + combined levels of every active enemy SAM
  covering that tile),
- the estimated "potential" atom count those SAM owners could reach with their
  visible gold,
- the total gold cost to clear the tile.

Only *active* enemy SAMs are counted, and only while the Atom Bomb tool is
active — outside that state the estimate never triggers.

### 2. Nuke Grouper

Clusters in-flight **Atom** and **Hydrogen** bombs whose target tiles fall
within roughly three blast radii of each other into one stable counter, labeled
by relation — `Your`, `Ally`, or `Enemy` — with atom (☢) and hydrogen (💣)
counts shown separately. Each label keeps one anchor point for as long as the
group has any active nuke, so it doesn't hop to the next nuke as older ones
disappear. MIRV warheads are ignored.

### 3. Better Spawn Selection

During spawn selection, marks other **human teammates** with your team's actual
color (the OpenFront theme color when available, otherwise a stable fallback),
so you can see at a glance who you're dropping in with. Marks disappear
automatically when spawn selection ends.

### 4. Incoming Nuke Alert

A HUD panel listing every nuke heading for **your** territory:

- type and count (☢ atom, 💣 hydrogen, 🚀 MIRV carrier, 💥 MIRV warheads),
- seconds until impact,
- whether your SAMs — including allies' and teammates' — can intercept them in
  time, with the number of intercepts available.

The panel updates live as nukes are intercepted or land. MIRV **carriers** can't
be intercepted, but the **warheads** they release are real nukes targeting your
tiles and *can* be shot down by SAMs in range.

### 5. Show Nukes in Airspace (+ Show Your Nukes)

A panel showing all nukes currently in the airspace: total in-flight atoms,
hydrogen bombs, MIRV carriers, and (when present) MIRV warheads.

The **Show Your Nukes** sub-toggle adds a personal row counting only the nukes
you launched. It depends on the airspace panel being enabled.

### 6. Enemy Nuke Readiness

Adds a row to the game's own player-info overlay — the panel shown when you
hover a player — telling you how many nukes that player has **ready right now**:

- a silo's ready count is its capacity (level) minus the missiles still
  reloading (`missileTimerQueue`), the same model the game uses for SAM
  launcher shots,
- how many of each type they could actually launch with their current gold
  (☢ atoms, 💣 hydrogen, 🚀 MIRV), priced with the game's own build-menu costs
  so the MIRV figure reflects the escalating per-launch cost,
- enemies with loaded silos but not enough gold are highlighted in amber.

### 7. Trade Partner

Rows on the player-info overlay (hover a player) covering how much you earn from
trading with them and how your navy has been doing against theirs. Each row
splits events into **"theirs"** (your navy vs them) and **"mine"** (their navy
vs you). Sub-toggles:

- **Trade Income** — the gold you receive from trading with that player: their
  ships arriving at your ports, your ships arriving at theirs, and trade ships
  your warships captured from them (the game pays the capturer on arrival).
  Shows as `Trade: +X/s · N ships`, or `Trade: stopped` when trading is off.
- **Trade Ship Captures** — ⚔ trade ships captured by warships.
- **Transport Ships Down** — 🚤 transport ships destroyed by warships.
- **Warships Down** — 💥 warships destroyed.

The naval counters are best-effort client-side heuristics (an owner change
counts as a capture; a ship disappearing next to an enemy warship counts as a
kill) and reset each game.

### 8. Gold Income Display

A draggable panel showing your gold income **per second** and/or **per minute**
(position is remembered). The total is *measured* from your own gold deltas —
the authoritative number — then apportioned into:

- **base** — the passive rate, `Config.goldAdditionRate` (100/tick human,
  50/tick bot) × the lobby `goldMultiplier`,
- **ports** — trade-ship arrivals, valued with the exact `Config.tradeShipGold`
  formula from the route length,
- **warships** — captured trade ships (the game pays the capturer on arrival),
- **factories** — train station stops, valued with the exact
  `Config.trainGold` formula.

Values are averaged over a 60-second rolling window. The split is reconciled to
the measured total, so a tracking miss degrades the split but never the number.
Conquest loot from killing players is never counted, and spending is ignored.

### 9. Troop Rate Display

A draggable panel showing your natural troop growth **per second** and/or **per
minute** (position is remembered). It evaluates the game's own
`Config.troopIncreaseRate(player)`:

`(10 + troops^0.73 / 4) × (1 − troops / maxTroops)`

The population cap comes from `Config.maxTroops` — building and upgrading
cities raises the cap and therefore the growth rate. It reports **natural
growth only**: attacking other players is never counted.

## What it doesn't do

No auto-join, boat macros, economy counters, alliance panels, bot markers,
heatmaps, or any feature that plays the game for you. Everything here only
*surfaces* information the game already knows.

## Install


### Chrome

1. Extract the extension folder (or ZIP) somewhere on disk.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `openfront-plus` folder.
6. Open an OpenFront tab — click the **Openfront+** icon in the toolbar to open
   the popup and enable the features you want.
7. If an OpenFront tab was already open before installing, reload it once.

### Other browsers

working to getting this extension to every extension webstore out there, if the broswer supports temporary addons or unpacked extensions then follow the same instructions as chrome (differs depending on your broswer)

## Notes

- This extension is **unofficial** and is not affiliated with or endorsed by
  OpenFront.
