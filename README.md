# Openfront+

A clean, separate Manifest V3 browser extension (Chrome, Edge, and Firefox) for
`https://openfront.io/*`.

It contains only:

1. **SAM Coverage** — while Atom Bomb mode is selected, waits 1.5 seconds after
   the cursor stops, then estimates the atom bombs and gold needed for the
   hovered tile. Only active enemy SAMs are counted.
2. **Nuke Grouper** — groups only active/in-flight **Atom Bombs** whose target
   tiles fall within roughly three Atom Bomb blast radii. Each label keeps one
   stable anchor while any atom bomb remains in that group, so it does not jump
   to the next nuke as older nukes disappear. Hydrogen Bombs and MIRV warheads
   are ignored. Counts disappear as soon as the group has no active atom bombs.
3. **Mark teammates with team color** — temporarily marks other human teammates
   during spawn selection, using the OpenFront theme color when available.
4. **Incoming Nuke Alert** — a HUD panel listing every nuke heading for your
   territory (atom, hydrogen, MIRV carrier, and MIRV warheads), with count and
   seconds until impact. MIRV carriers can't be intercepted, but the warheads
   they release are real nukes and can be shot down by SAMs in range. The panel
   reports how many intercepts your SAMs (including allies'/teammates') can fire
   before impact and whether that's enough.
5. **Show Nukes in Airspace** — a UI panel showing all nukes currently in the
   airspace, including MIRV warheads, plus an optional personal row listing
   only your own nukes.
6. **Gold Income Display** — draggable panel showing your income per second
   and/or per minute. The total is measured from your own gold deltas, then
   split into base / ports / factories: the passive base
   (`Config.goldAdditionRate` = 100/tick human, 50/tick bot, × `goldMultiplier`)
   is read from the game's config, and port income (trade-ship arrivals) vs
   factory income (City/Port train stops) is detected client-side and valued
   with the exact `Config.tradeShipGold` / `Config.trainGold` formulas, averaged
   over a 60 s rolling window. The split is reconciled to the sampled total, so
   a tracking miss never changes the number. Conquest loot from killing players
   is never counted.
7. **Troop Rate Display** — draggable panel showing natural troop growth. It
   evaluates the game's own `Config.troopIncreaseRate(player)`, which applies
   the per-tick formula `(10 + troops^0.73 / 4) × (1 − troops / maxTroops)`.
   The population cap comes from `Config.maxTroops` — building and upgrading
   cities raises the cap and therefore the growth rate. It reports natural
   growth only: attacking other players is never counted.
8. **Enemy Nuke Readiness** — adds a row to the game's own player-info
   overlay (the panel shown when you hover a player) telling you how many of
   that player's nukes are ready, based on their missile silos. A silo's ready
   count is its capacity (level) minus the missiles still in cooldown
   (`missileTimerQueue`), the same model the game uses for SAM launcher shots.
   It also shows how many of each nuke type they could actually launch right
   now with their current gold (☢ atoms, 💣 hydrogen, 🚀 MIRV) — using the
   game's own build-menu costs, so the MIRV price reflects the escalating
   per-launch cost. Enemies with loaded silos but not enough gold are
   highlighted in amber.

No auto-join, boat macro, economy counters, alliance panel, bot markers,
heatmaps, or other helper features are included.

## Install

### Chrome / Edge

1. Extract the ZIP.
2. Open `chrome://extensions` in Chrome or Edge.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `nuke-ui-label` folder.
6. Open the extension popup and enable the features you want.
7. Reload an already-open OpenFront tab once after installing.

### Firefox

1. Extract the ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select the `manifest.json` file inside the extracted folder.
5. Open the extension popup and enable the features you want.
6. Reload an already-open OpenFront tab once after installing.

> Temporary add-ons load only until Firefox restarts. To install permanently,
> package the folder as a `.zip` and sign it via
> [addons.mozilla.org](https://addons.mozilla.org/developers/) (the
> `browser_specific_settings.gecko.id` in `manifest.json` is already set for
> submission).

SAM Coverage activates only while OpenFront reports
`ghostStructure === "Atom Bomb"`. Pressing `8` or clicking the Atom Bomb tool
normally sets that exact game state. Outside that state, mouse movement and
cursor pauses do not trigger the estimate.

## SAM estimate

The current requirement is estimated as:

`1 atom + the combined levels of all active enemy SAMs covering the tile`

Potential is counted once per covering SAM owner:

- 3m visible gold: `+1`
- 6m visible gold: `+2`
- 9m or more visible gold: `+3`

The cost display uses 750k gold per Atom Bomb. If OpenFront's internal objects
cannot be read safely, the label shows `tracking` or stays hidden.

## Notes

- Settings are stored only in `browser.storage.local` (works in Chrome, Edge,
  and Firefox via the `browser`/`chrome` namespace shim).
- OpenFront's game objects are minified and can change. The bridge uses several
  known component hooks plus defensive fallbacks so a missing hook will not
  crash the page.
- Gold/troop numbers come from reading OpenFront's own config objects when they
  are available (`Config.goldAdditionRate`, `Config.tradeShipGold`,
  `Config.trainGold`, `Config.troopIncreaseRate`, `Config.maxTroops`); the
  sampling fallbacks only kick in when the config or the unit API can't be
  reached.
- This extension is unofficial and is not affiliated with or endorsed by
  OpenFront.
