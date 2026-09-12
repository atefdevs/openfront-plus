# Openfront+

A **Manifest V3** browser extension for the browser game
[OpenFront.io](https://openfront.io) that adds quality-of-life overlays and
readouts.

Everything runs locally. The extension only reads what the game page already
shows and draws on top of it — no accounts, no network calls, no cheats. It just
makes information the game already has easier to see.

## Features

### 1. SAM Coverage
While the **Atom Bomb** tool is selected (press `8`), rest your cursor over a
tile and a label shows:
- how many atoms you need to clear the tile,
- the potential extra atoms the SAM owners could afford,
- the total gold cost.

Every active SAM covering the tile is counted except your own (allies',
teammates', enemies'), and only while the Atom Bomb tool is active. How long
you must hold the cursor is adjustable in the popup (Hover delay, 0–5 s,
default 1 s).

### 2. Nuke Grouper
Clusters nearby in-flight nukes into stable counters labeled `Your`, `Ally`, or
`Enemy`, with ☢ atom and 💣 hydrogen counts shown separately — each label also
names who launched them (`Enemy · Alice`, `Ally · Bob, Cara +1 more`,
`You · Dave`). Each label stays in one spot as long as the group has any active
nuke, so it doesn't jump around as older nukes disappear. MIRV warheads are ignored.

### 3. Better Spawn Selection
During spawn selection, marks your other **human teammates** with your team's
actual color, so you can see at a glance who you're dropping in with. The marks
disappear automatically when spawn selection ends.

### 4. Incoming Nuke Alert
A HUD panel listing every nuke heading for **your** territory:
- type and count (☢ atom, 💣 hydrogen, 🚀 MIRV carrier, 💥 MIRV warheads),
- seconds until impact,
- whether your SAMs (including allies' and teammates') can intercept them in
  time.

Updates live as nukes are intercepted or land. MIRV carriers can't be shot down,
but the warheads they release can. Intercept estimates use each nuke's real
flight path — SAM missile travel time, reload cycles, and in-progress upgrades
are all accounted for, matching the game's own preshot logic. Nukes whose
target sits outside your land but whose blast still reaches it show up as
`~splash` rows instead of being silently skipped. Click a row to jump the camera to that nuke.

### 5. Show Nukes in Airspace
A panel showing every nuke currently in the airspace, with global counts of
in-flight atoms, hydrogen bombs, MIRV carriers, and (when present) MIRV
warheads.

**Show Your Nukes** (sub-toggle) adds a personal row counting only the nukes you
launched. It needs the airspace panel enabled.

### 6. Enemy Nuke Readiness
When you hover a player, adds a row to the game's info panel showing how many
nukes that player has **ready right now** and how many they can actually afford
to launch with their current gold (☢ atoms, 💣 hydrogen, 🚀 MIRV). Enemies with
loaded silos but not enough gold are highlighted in amber.

### 7. Player Intel
Hover rows with things the game's own overlay never shows. Sub-toggles:
- **Embargo & Doomsday Badges** — who embargoes whom (either direction), plus
  doomsday-clock / decaying status.
- **Launcher Readiness %** — share of their SAM and silo tubes actually ready
  to fire right now, reloads counted as not ready.

### 8. Trade Partner
When you hover a player, adds rows to the game's info panel covering your trade
and naval interactions with them. Events are split into **"theirs"** (your navy
vs them) and **"mine"** (their navy vs you). Sub-toggles:
- **Trade Income** — gold you receive from trading with that player.
- **Trade Ship Captures** — ⚔ trade ships captured by warships.
- **Transport Ships Down** — 🚤 transport ships destroyed.
- **Warships Down** — 💥 warships destroyed.

The naval counters are best-effort client-side estimates and reset each game.
Trade income includes port-to-port trade ships, captured ships your warships
bring in, and train stops at each other's cities/ports/factories — shown per
second and per minute.

### 9. Player Stats Overlay
Adds rows to the player-info overlay (shown when you hover a player):
- **Troop Rate (Others)** — their natural troop growth per second/minute,
  straight from the game's own formula (same figure as your Troop Rate panel).
- **Gold Income (Others)** — their gold income per second/minute, measured from
  their gold changes over the last 60 s (same model as your Gold Income panel),
  with a base/ports/warships/factories breakdown estimated from detected
  payouts to that player.

### 10. Gold Income Display
A draggable panel showing your gold income **per second** and/or **per minute**
(position is remembered). The total is measured from your actual gold, then split
into:
- **base** — the passive rate,
- **ports** — trade-ship arrivals,
- **warships** — captured trade ships,
- **factories** — train station stops.

Values are averaged over a 60-second window. Conquest loot from killing players
is never counted, and spending is ignored.

### 11. Troop Rate Display
A draggable panel showing your natural troop growth **per second** and/or **per
minute** (position is remembered). It uses the game's exact growth formula, so
it matches the server even while you're under attack. Building cities raises
your population cap and therefore the growth rate. Reports **natural growth
only** — attacking other players is never counted.

### 12. Build Progress Labels
While a structure is under construction (city, port, factory, defense post,
missile silo, SAM launcher), a small label appears under its build bar showing
the percentage complete and the remaining build time in seconds. Durations come
from the game's own config, so they match the server exactly.

## What it doesn't do

No auto-join, boat macros, economy cheats, alliance panels, bot markers,
heatmaps, or anything that plays the game for you. It only *surfaces*
information the game already knows.

## Browser support

| Browser | Status | Notes |
|---|---|---|
| Chrome | ✅ Same package, no changes | Chrome 105+ (for `:has()` selectors) |
| Brave | ✅ Same package, no changes | `brave://extensions` → Developer mode → Load unpacked. Shields don't affect it |
| Edge | ✅ Same package, no changes | `edge://extensions` → Developer mode → Load unpacked |
| Opera / Vivaldi / Arc | ✅ Same package, no changes | Any Chromium base works; use developer mode, or Opera's "Install Chrome Extensions" for store builds |
| Firefox | ✅ Already configured | Add-on ID + MV3 manifest included; submitted to the Firefox Add-ons store. `about:debugging#/runtime/this-firefox` → Load Temporary Add-on for testing |
| Safari | ⚠️ Code-compatible, manual step needed | Standard MV3 + promise APIs throughout, so the code itself runs — but Apple requires converting with Xcode (`xcrun safari-web-extension-converter`) and a paid Developer account to distribute |

## Install

### Chrome, Brave, Edge, Opera (Chromium)
1. Extract the extension folder (or ZIP) somewhere on disk.
2. Open your browser's extensions page (`chrome://extensions`, `brave://extensions`, `edge://extensions`, or `opera://extensions`).
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `openfront-plus` folder.
6. Open an OpenFront tab, click the **Openfront+** icon, and enable the features
   you want.
7. If an OpenFront tab was already open before installing, reload it once.

### Firefox
The extension is already submitted to the Firefox Add-ons store. (https://addons.mozilla.org/en-US/firefox/addon/openfront/ if you want to download it)

### Safari
Not packaged yet — requires Apple's Xcode converter and Developer account (see table above). The code needs no changes, only the conversion step.

## Notes

- Settings are stored locally and persist between games.
- The extension only runs on `https://openfront.io` — embedded hosts such as
  CrazyGames aren't covered.
- This extension is **unofficial** and is not affiliated with or endorsed by
  OpenFront.
