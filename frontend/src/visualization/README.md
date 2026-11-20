# 3D Visualization (SGRAI)

VIS01 registers a lazy `kitchenViewer` module at `/kitchen/viewer` for
Restaurant Staff and Managers. It uses the common SPA shell and receives its
authenticated `request` function from the module slot. WEB03 handles permission
changes and expired sessions.

- `viewer/` validates the WEB06 response, maps outcomes to localized feedback
  and coordinates one canvas and engine per attempt.
- `scene/` loads all binary assets within one 30-second deadline, manages the
  WebGL renderer and owns cleanup and failure recovery.
- `scene/modules/` holds the scene modules. `scene/defaultSceneModules.js`
  builds the kitchen layout (VIS02), the assembly line (VIS03), scene lighting
  (VIS05) and camera controls (VIS07), in that order.

The viewer shows a scene only after the active configuration is valid, all its
assets have loaded and the engine has rendered its first frame. An empty state
requires the backend's `404` with `NO_ACTIVE_CONFIGURATION`. Retry and Reload
start a fresh attempt. Other states cover an invalid response, an unavailable
asset or request, unsupported WebGL 2, engine failure, permission denial,
session expiration and cancellation.

Each scene module factory creates one module with `build(context)`,
`update(deltaSeconds)` and `dispose()`. Modules receive the unchanged WEB06
response and can borrow assets through `context.assets.getModel(id)` and
`getTexture(id)`. A model lookup returns the decoded glTF result, including its
scene and animations. Clone scene instances when sharing models. Register
each resource as it is created and use `context.disposeResource(resource)` for
owned resources. The engine owns the assets. Asynchronous builds must check
`context.signal` around awaits and release any result that arrives after abort.

Coordinates use metres, Y-up, the centre of the floor as origin and `-Z` as
north. The baseline perspective camera points at the origin.

## Kitchen layout (VIS02)

`KitchenLayoutModule` draws the room and every `EQUIPMENT` element of the
active configuration under `layout:root`. It never moves the camera: the
camera pose belongs to VIS07.

- `room/` builds the floor and four walls from `kitchen.dimensions`. They are
  single-sided planes facing into the room, without a ceiling, so the walls
  in front of an outside camera are not drawn. Their UVs are in metres.
- `elements/` turns one element into one object, named with the element id.
  VIS03 uses the same factory for `ASSEMBLY_LINE` elements. `PROCEDURAL`
  shapes (`BOX`, `CYLINDER`, `SPHERE`, `DOME`) have `size` as their bounding
  box with the origin at the bottom centre. `ASSET` models are cloned from the
  loaded assets and used as they are. Placement is position (metres), rotation
  (degrees, Euler order `XYZ`) and scale, applied in that order.
- `materials/` holds the baseline material factory, which VIS04 refines.
  Colour maps are cloned to use sRGB. Room maps are cloned to repeat.
- Model files follow the WEB06 convention: glTF / GLB, metres, Y-up, origin
  at the bottom centre. The front of an equipment model faces `+Z`, so
  equipment against the `NORTH`, `SOUTH`, `EAST` or `WEST` wall uses
  `rotation.y` 0, 180, -90 or 90.
- Objects that are not elements are named with a `:` prefix, such as
  `layout:root`, `room:floor` or `room:wall:NORTH`, so they never clash with
  an element id.

An element that cannot be built throws `ElementBuildError`. The viewer then
fails without showing a partial kitchen. The module releases only what it
creates; loaded models and textures stay with `LoadedAssets`. Asset credits
are in `backend/assets/kitchen/CREDITS.md`.

The VIS01 design records the [assessment of the Three.js integration libraries](../../../docs/user_stories/vis/vis01/usVIS01.md#framework-integration-assessment)
and the [equivalent steps in the Angular tutorial](../../../docs/user_stories/vis/vis01/usVIS01.md#52-mapping-from-the-sgrai-starter-tutorial).

Run the VIS01 and VIS02 tests from
`frontend` with
`npm test -- --runInBand src/visualization test/app/App.test.jsx`. See
[VIS01 manual verification](../../../docs/user_stories/vis/vis01/usVIS01.md#62-manual-verification--openapi-contract)
for the browser and WEB06 scenarios.

## Scene lighting (VIS05)

`KitchenLightingModule` fits its ambient light and spotlight to the built
kitchen before the first frame. A prefiltered indoor environment supplies
reflections for metallic surfaces. The static spotlight shadow map is
reused during camera movement. Reload rebuilds the lighting for the new
layout and releases the previous environment and shadow resources.

The [VIS05 verification record](../../../docs/user_stories/vis/vis05/usVIS05.md#6-integration-verification--demonstration)
includes the browser views and shadow-on/off measurements for both sample kitchens.
