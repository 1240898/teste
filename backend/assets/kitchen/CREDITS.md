# Kitchen asset credits

Every model and texture file of `manifest.json` is listed here (usVIS02 BR 14, D13).
The equipment models are made by the team in code: they are generated from the
recipes in `backend/scripts/kitchen-models/models.js` by `npm run kitchen:models`.
They have no textures; the layout JSON gives each element its texture set.
The textures are CC0 PBR maps from ambientCG (1k PNG, OpenGL normal maps), as
required by usVIS04 BR 22 and D18; they replace the demo placeholders.
Third-party files may only be added when their licence allows reuse (CC0 or CC BY);
a CC BY file must keep the author, the source URL and the licence below.

| Asset id | File | Title | Author | Source | Licence |
| --- | --- | --- | --- | --- | --- |
| AST-MDL-DISPENSER-01 | models/dispenser-01.glb | Overhead crust dispenser (placeholder box) | LaPrizza team | `npm run kitchen:demo-assets` | Project licence |
| AST-MDL-CONVEYOR-01 | models/conveyor-01.glb | Conveyor belt segment (placeholder box) | LaPrizza team | `npm run kitchen:demo-assets` | Project licence |
| AST-MDL-ROBOT-ARM-01 | models/robot-arm-01.glb | Robotic arm (placeholder box) | LaPrizza team | `npm run kitchen:demo-assets` | Project licence |
| AST-MDL-DISPENSER-02 | models/dispenser-02.glb | Overhead dispenser with a hinged release gate | LaPrizza team | `npm run kitchen:models` (embedded steel colour and normal maps from this catalogue) | Project licence |
| AST-MDL-CONVEYOR-02 | models/conveyor-02.glb | Conveyor frame and separate belt surface | LaPrizza team | `npm run kitchen:models` (embedded steel colour and normal maps from this catalogue) | Project licence |
| AST-MDL-ROBOT-ARM-02 | models/robot-arm-02.glb | Articulated ingredient dispenser arm | LaPrizza team | `npm run kitchen:models` (embedded steel colour and normal maps from this catalogue) | Project licence |
| AST-MDL-OVEN-LINE-01 | models/oven-line-01.glb | Wood-fired dome oven with recessed conveyor intake | LaPrizza team | `npm run kitchen:models` (embedded steel and tile maps from this catalogue) | Project licence |
| AST-MDL-OVEN-DOME-01 | models/oven-dome-01.glb | Dome wood-fired oven (placeholder box) | LaPrizza team | `npm run kitchen:demo-assets` | Project licence |
| AST-MDL-OVEN-DOME-02 | models/oven-dome-02.glb | Dome wood-fired oven: base, hearth, dome, mouth arch and chimney | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-FRIDGE-01 | models/fridge-01.glb | Refrigerator (placeholder box) | LaPrizza team | `npm run kitchen:demo-assets` | Project licence |
| AST-MDL-FRIDGE-02 | models/fridge-02.glb | Upright two-door refrigerator with handles and display | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-TABLE-PLAIN-01 | models/table-plain-01.glb | Work table: top, legs, apron and lower shelf | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-COUNTER-01 | models/counter-01.glb | Base cabinet counter with worktop and three doors | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-DEEP-FRYER-01 | models/deep-fryer-01.glb | Deep fryer with oil well, two baskets and flue | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-GRIDDLE-01 | models/griddle-01.glb | Flat-top griddle with cooking plate and splash guard | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-GRILL-01 | models/grill-01.glb | Char grill with grate bars over a burner | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-DISHWASHER-01 | models/dishwasher-01.glb | Front-loading dishwasher with control panel | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-EXHAUST-HOOD-01 | models/exhaust-hood-01.glb | Wall canopy exhaust hood with grease filters and duct | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-PIZZA-PEEL-01 | models/pizza-peel-01.glb | Pizza peel | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-PAN-01 | models/pan-01.glb | Frying pan | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-MDL-POT-01 | models/pot-01.glb | Stock pot with lid | LaPrizza team | `npm run kitchen:models` (scripts/kitchen-models) | Project licence |
| AST-TEX-TILES-COLOR | textures/tiles-color.png | Floor tiles - colour map (Tiles074) | ambientCG | https://ambientcg.com/view?id=Tiles074 | CC0 1.0 |
| AST-TEX-TILES-NORMAL | textures/tiles-normal.png | Floor tiles - normal map, OpenGL (Tiles074) | ambientCG | https://ambientcg.com/view?id=Tiles074 | CC0 1.0 |
| AST-TEX-PLASTER-COLOR | textures/plaster-color.png | Wall plaster - colour map (Plaster001) | ambientCG | https://ambientcg.com/view?id=Plaster001 | CC0 1.0 |
| AST-TEX-PLASTER-ROUGH | textures/plaster-rough.png | Wall plaster - roughness map (Plaster001) | ambientCG | https://ambientcg.com/view?id=Plaster001 | CC0 1.0 |
| AST-TEX-STEEL-COLOR | textures/steel-color.png | Steel - colour map (Metal032) | ambientCG | https://ambientcg.com/view?id=Metal032 | CC0 1.0 |
| AST-TEX-STEEL-ROUGH | textures/steel-rough.png | Steel - roughness map (Metal032) | ambientCG | https://ambientcg.com/view?id=Metal032 | CC0 1.0 |
| AST-TEX-STEEL-NORMAL | textures/steel-normal.png | Steel - normal map, OpenGL (Metal032) | ambientCG | https://ambientcg.com/view?id=Metal032 | CC0 1.0 |
| AST-TEX-WOOD-COLOR | textures/wood-color.png | Wood - colour map (Wood049) | ambientCG | https://ambientcg.com/view?id=Wood049 | CC0 1.0 |
| AST-TEX-WOOD-NORMAL | textures/wood-normal.png | Wood - normal map, OpenGL (Wood049) | ambientCG | https://ambientcg.com/view?id=Wood049 | CC0 1.0 |
