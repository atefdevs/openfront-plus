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
tile for 1.5 seconds and a label shows:
- how many atoms you need to clear the tile,
- the potential extra atoms the SAM owners could afford,
- the total gold cost.

Only active enemy SAMs are counted, and only while the Atom Bomb tool is active.

### 2. Nuke Grouper
Clusters nearby in-flight nukes into stable counters labeled `Your`, `Ally`, or
`Enemy`, with ☢ atom and 💣 hydrogen counts shown separately. Each label stays in
one spot as long as the group has any active nuke, so it doesn't jump around as
older nukes disappear. MIRV warheads are ignored.

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
are all accounted for, matching the game's own preshot logic.

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

### 7. Trade Partner
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

### 8. Player Stats Overlay
Adds rows to the player-info overlay (shown when you hover a player):
- **Troop Rate (Others)** — their natural troop growth per second/minute,
  straight from the game's own formula (same figure as your Troop Rate panel).
- **Gold Income (Others)** — their gold income per second/minute, measured from
  their gold changes over the last 60 s (same model as your Gold Income panel),
  with a base/ports/warships/factories breakdown estimated from detected
  payouts to that player.

### 9. Gold Income Display
A draggable panel showing your gold income **per second** and/or **per minute**
(position is remembered). The total is measured from your actual gold, then split
into:
- **base** — the passive rate,
- **ports** — trade-ship arrivals,
- **warships** — captured trade ships,
- **factories** — train station stops.

Values are averaged over a 60-second window. Conquest loot from killing players
is never counted, and spending is ignored.

### 10. Troop Rate Display
A draggable panel showing your natural troop growth **per second** and/or **per
minute** (position is remembered). It uses the game's exact growth formula, so
it matches the server even while you're under attack. Building cities raises
your population cap and therefore the growth rate. Reports **natural growth
only** — attacking other players is never counted.

### 11. Build Progress Labels
While a structure is under construction (city, port, factory, defense post,
missile silo, SAM launcher), a small label appears under its build bar showing
the percentage complete and the remaining build time in seconds. Durations come
from the game's own config, so they match the server exactly.

## What it doesn't do

No auto-join, boat macros, economy cheats, alliance panels, bot markers,
heatmaps, or anything that plays the game for you. It only *surfaces*
information the game already knows.

## Install

### Chrome
1. Extract the extension folder (or ZIP) somewhere on disk.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `openfront-plus` folder.
6. Open an OpenFront tab, click the **Openfront+** icon, and enable the features
   you want.
7. If an OpenFront tab was already open before installing, reload it once.

### Firefox
The extension is already submitted to the Firefox Add-ons store. 

### Other browsers
Any browser that supports temporary or unpacked extensions can load it the same
way as Chrome (the exact steps differ per browser), working on getting this extension to every webstore out there

## Notes

- Settings are stored locally and persist between games.
- The extension only runs on `https://openfront.io` — embedded hosts such as
  CrazyGames aren't covered.
- This extension is **unofficial** and is not affiliated with or endorsed by
  OpenFront.
