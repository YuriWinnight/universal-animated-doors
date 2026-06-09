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
