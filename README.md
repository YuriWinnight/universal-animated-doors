# Universal Animated Doors

Foundry VTT v11 module that draws animated textured doors and moves temporary
light-blocking walls with the door animation.

## Install

1. Disable the old `v11-animated-doors` module in every world where it is active.
2. Remove the old `Data/modules/v11-animated-doors` folder.
3. Extract `universal-animated-doors` into `Data/modules/`.
4. Restart Foundry VTT.
5. Enable `Universal Animated Doors` in the world.
6. Hard-refresh the browser page with Ctrl+F5.

Existing door flags from `v11-animated-doors` are still read, so configured
doors keep their textures and animation settings after the package rename.

## 0.6.17

- Mirrored swing-door textures now keep a matching hinge side. When `Flip`
  moves the handle to the opposite side, the swing origin moves to the opposite
  end of the wall segment instead of opening from the handle side. This applies
  to single and double swing doors while preserving the visual texture mirror.

## 0.6.16

- Door artwork now renders slightly above the wall's lower Levels elevation
  while keeping the wall, click control, and light-refraction geometry on the
  original wall. This keeps doors on ranges like `10-20` visible above same-level
  floor tiles without putting them above higher-elevation roof or wall art.
- Levels visibility now uses range overlap instead of requiring the door range
  to be fully contained in the selected UI range. This avoids boundary issues at
  exact split points such as `0-10` and `10-20`.

## 0.6.15

- When the Levels UI is open for a GM, animated door texture visibility now
  follows the currently selected Levels range before considering selected
  tokens or active vision sources. This prevents doors placed on higher levels
  from disappearing just because a token or vision source is still on elevation
  0.

## 0.6.14

- Wall create/update/delete hooks are now scoped to the currently rendered
  Scene, including async texture-load completion. Animated door textures from
  other maps no longer appear on the active map, even when wall IDs overlap or
  a scene changes while a texture is loading.
- Added Levels and Wall Height range handling for animated door artwork and
  temporary light-refraction walls. Door textures follow the wall's configured
  height range instead of always behaving like zero-elevation artwork, and their
  visibility updates when the Levels UI, perspective token, or token elevation
  changes.

## 0.6.13

- Closing doors no longer temporarily set the real wall's `sight` and `light`
  restrictions to `None`. Foundry blocks vision and light immediately according
  to the wall settings as soon as the door closes, unless those settings are
  intentionally set to `None`.
- Legacy cleanup for old restore flags remains, so walls affected by older
  builds can still be repaired on scene load.

## 0.6.12

- Added a fail-safe restore for the real wall's `sight` and `light`
  restrictions after closing-door light refraction. If Foundry drops or delays
  the normal animation cleanup, the wall no longer remains stuck as
  `None/None`, so players should not see through a closed door.

## 0.6.11

- Secret doors now keep their animated door texture visible to players while
  still relying on Foundry's native secret-door behavior for the hidden wall and
  door-control icon. The module's artwork remains non-interactive.

## 0.6.10

- Replaced the huge city metal gate preset with the user-provided
  `254762661_nw_prev.m4a` audio file, bundled as
  `sounds/huge-city-metal-gate.m4a`.

## 0.6.9

- Replaced the huge city metal gate preset with an original medieval-style
  portcullis/city-gate WAV. It no longer uses the modern industrial sliding
  door sound.
- Added per-door visual texture offsets: `offsetX` and `offsetY`, in scene
  pixels. These move only the animated door artwork; the Foundry Wall document,
  clickable door control, secret-door state, and light-refraction wall remain
  anchored to the original wall coordinates.

## 0.6.8

- Door artwork now renders in Foundry's primary canvas group instead of inside
  the Walls layer. Foreground images, roof tiles, and wall-art tiles can now
  occlude animated door textures by normal Foundry elevation/sort rules, so
  door textures no longer draw through higher wall art.
- Door artwork keeps a low primary sort value at its wall elevation. It stays
  above the scene background but below same-elevation tiles with normal tile
  sort values.
- Keeps the 0.6.7 native `doorSound` registration for the bundled sound
  presets.

## 0.6.7

- Registers the five bundled door sounds as standard Foundry `doorSound`
  choices, so they appear in the native Wall Configuration sound dropdown and
  work with Foundry's built-in preview button.
- Removed the separate module-specific sound selector from the animated-door
  fieldset. Door sounds now use the same field as every other Foundry door
  sound preset.
- Kept legacy module sound flags harmlessly ignored; existing animation,
  texture, secret-door, and light-refraction settings are not reset.

## 0.6.6

- Reverted the 0.6.5 vertical texture stretching. Door textures are again only
  fitted down to the grid height when they are too tall; they are not enlarged
  to wall-height or levels data.
- Keeps wall geometry rebuilds, but elevation/height flags are now used only for
  door texture sorting, not for sprite scaling.
- Door sounds now use the module socket with local playback fallback instead of
  relying only on `AudioHelper.play(..., true)`, so selected presets should play
  for connected clients more reliably.
- Sound playback is restricted to bundled preset paths.

## 0.6.5

- Secret doors now use the same animated-door path as normal doors. Saving a
  secret door no longer disables or clears the module's door flags.
- Door textures now scale to the wall's visual height. Native scenes use the
  grid size; wall-height/levels-style elevation flags are used when present.
- Rebuilds the door overlay when wall geometry changes, so moved or resized
  walls no longer keep stale texture dimensions.
- Added bundled door sound presets: heavy wooden sliding door, heavy stone
  sliding door, heavy metal sliding door, heavy prison cell door, and huge city
  metal gate. Sounds are off by default per door.
- Bundled sound source attribution is in `sounds/LICENSES.md`.

## 0.6.4

- Added a real requestAnimationFrame frame monitor for light refraction. The
  module now reacts to actual client FPS drops instead of only measuring Wall
  document update latency.
- Rebalanced the default light-wall cadence to a smoother-but-safer target of
  roughly 16 light positions for a 500 ms door animation.
- Adaptive throttling now starts backing off when frames repeatedly exceed the
  smooth-frame budget, so scenes dropping toward the 30-40 FPS range reduce Wall
  update pressure automatically.
- Recovery is intentionally slower than slowdown, preventing rapid interval
  oscillation while a door is moving.

## 0.6.3

- Rebalanced light refraction toward smoothness again. Standard 500 ms door
  animations now target roughly 18 light-wall positions instead of the visibly
  stepped 0.6.2 cadence.
- Made adaptive throttling less abrupt: normal overload now needs repeated slow
  updates before the interval backs off, while severe stalls still trigger a
  protective slowdown.
- Shortened predictive light sampling so shadows no longer jump unnaturally far
  ahead of the visible door texture.
- Kept pending-coordinate coalescing and duplicate perception-refresh removal
  from 0.6.2, so the smoother cadence still avoids stale update backlogs.

## 0.6.2

- Reduced the default temporary light-wall cadence to a player-safer 48-130 ms
  range while keeping the visible door texture animation on requestAnimationFrame.
- Added adaptive light-wall pacing. If Foundry wall updates or the client event
  loop start taking too long, the module backs off automatically instead of
  forcing the scene to recalculate lighting too often.
- Coalesced pending light-wall coordinates now drain on the same adaptive
  cadence, so slow scenes do not immediately start another heavy wall update as
  soon as the previous one finishes.
- Keeps predictive light sampling so the shadow still follows fast 500 ms door
  swings without needing high-frequency Wall document updates.
- Removed duplicate explicit perception refreshes from normal door open/close
  cleanup. Foundry already queues lighting and vision recalculation for Wall
  create/update/delete operations; the manual refresh remains only for old
  temporary-wall cleanup.

## 0.6.1

- Removed the 0.6.0 virtual quadtree light-wall path because it could freeze the
  Foundry canvas while UI controls still responded.
- Restored the stable temporary Wall document light-refraction workflow.
- Kept latest-coordinate coalescing while a previous wall update is still in
  flight, so the module avoids building a backlog of stale movement updates.
- Uses a conservative 30-60 ms light-wall cadence with adaptive lead sampling to
  reduce texture/shadow lag without returning to unsafe local quadtree mutation.

## 0.6.0

- Reworked light refraction to use local virtual light walls registered in the
  Foundry wall quadtree instead of creating and moving temporary Wall documents.
- Light-wall movement no longer sends per-step scene document updates or socket
  traffic; each client computes the animated blocker locally.
- Closing doors now locally relax the real wall's light/sight restriction during
  the animation and restore it at the end, so light fades with the moving
  virtual wall without mutating the world document.
- Virtual walls maintain nearby intersection data against existing walls and
  scene bounds, then clean those intersections when they move or are removed.
- Kept cleanup for temporary Wall documents and restore flags left behind by
  older 0.4-0.5 builds.

## 0.5.4

- Synced temporary light-wall sampling to the same animation timeline used by
  the visible door texture.
- Removed update-response latency from the light animation timer. The timer now
  keeps moving at its target cadence while Foundry document updates are sent in
  order.
- Collapses queued light-wall movement updates to the newest coordinates when a
  previous Foundry wall update is still in flight.
- Adds adaptive lead compensation based on measured wall-update latency so fast
  500 ms door swings keep the shadow closer to the texture.
- Increased the target light-wall movement density to 24-45 ms steps.

## 0.5.3

- Made light refraction updates denser again while keeping the stable
  document-backed temporary wall workflow.
- Removed forced lighting and vision refresh calls from every intermediate
  light-wall movement step; Foundry's own wall update pipeline now batches the
  required perception refresh.
- Started the first temporary light-wall movement update immediately after the
  wall documents are available, so light motion stays aligned with the visible
  door animation instead of jumping after the first interval.
- Skipped unchanged rounded wall coordinates to avoid redundant scene updates.
- Removed the unused local quadtree light-wall experiment from the package.

## 0.5.2

- Disabled the local quadtree light-wall animation path because it could freeze
  the Foundry canvas on heavy scenes.
- Restored the stable document-backed temporary light-wall workflow.
- Limited light-wall movement updates to 45-90 ms steps to avoid canvas stalls
  while keeping door texture animation smooth.

## 0.5.1

- Prevented client freezes by throttling expensive Foundry lighting/vision
  recomputation during light refraction.
- Removed per-frame wall intersection rebuilds for local temporary light walls.
- Kept visual door movement on `requestAnimationFrame` while limiting heavy
  perception updates to a safe cadence.

## 0.5.0

- Reworked light refraction to use local client-side temporary walls in the
  Foundry wall quadtree instead of creating and updating Wall documents.
- Light refraction now runs independently on every connected client.
- Closing doors temporarily relax their real light/sight restriction locally
  while the animated temporary wall moves into place, then restore it.
- Removed per-frame scene database writes from the animation path.

## 0.4.0

- Renamed the package folder and manifest id to `universal-animated-doors`.
- Renamed the displayed module title to `Universal Animated Doors`.
- Increased temporary light-wall update frequency for smoother light refraction.
- Added smooth light disappearance while doors close.
- Restores a real wall's original `sight` and `light` values after closing.
- Cleans up temporary light walls and unfinished closing restore flags on scene load.
