/**
 * VIS02 - recipes of the kitchen equipment models, made by the team in code (usVIS02 D19).
 *
 * Convention (usWEB06 2.4.3): metres, Y-up, origin at the bottom centre of the
 * bounding box, front of the equipment facing +Z (a model against the north,
 * south, east or west wall uses rotation.y 0, 180, -90 or 90).
 *
 * Every model is made of named parts, so that the tests can check the shape
 * of each type and not only its type metadata (the part names are a contract).
 * Materials are colour / metalness / roughness factors only: the models carry
 * no textures (SGRAI Sprint 2 slide 13) and every element that uses them gets
 * its texture set from the layout JSON (`material`, usWEB06 BR 18).
 */
import { block, box, cylinder, dome, merge } from './geometry.js';

// --- materials ---------------------------------------------------------------

const STEEL = {
  colour: [196, 200, 206],
  metallic: 0.8,
  roughness: 0.35,
};
const DARK_STEEL = {
  colour: [70, 72, 76],
  metallic: 0.7,
  roughness: 0.5,
};
const CHROME = { colour: [228, 230, 234], metallic: 1, roughness: 0.15 };
const BLACK = { colour: [28, 28, 30], metallic: 0, roughness: 0.6 };
const CAST_IRON = { colour: [42, 42, 44], metallic: 0.6, roughness: 0.55 };
const GLASS = { colour: [40, 95, 140], metallic: 0.1, roughness: 0.1 };

const xs = (count, from, to) =>
  Array.from(
    { length: count },
    (_, i) => from + ((to - from) * i) / (count - 1),
  );

/** Four small feet under a cabinet whose footprint is [x0, x1] x [z0, z1]. */
const feet = (x0, x1, z0, z1, height = 0.05, inset = 0.05) =>
  merge(
    ...[
      [x0 + inset, z0 + inset],
      [x1 - inset, z0 + inset],
      [x0 + inset, z1 - inset],
      [x1 - inset, z1 - inset],
    ].map((centre) =>
      cylinder({ radius: 0.022, from: 0, to: height, centre, segments: 12 }),
    ),
  );

/** Control knobs on a front face at z = front, pointing to +Z. */
const knobs = (positions, y, front, length = 0.04) =>
  merge(
    ...positions.map((x) =>
      cylinder({
        axis: 'z',
        radius: 0.022,
        from: front,
        to: front + length,
        centre: [x, y],
        segments: 16,
      }),
    ),
  );

// --- equipment -----------------------------------------------------------------

/** REFRIGERATOR - upright two-door fridge, 0.9 x 2.0 x 0.8 m. */
const fridge = {
  name: 'Refrigerator',
  materials: { steel: STEEL, trim: DARK_STEEL, chrome: CHROME, display: GLASS },
  parts: [
    {
      name: 'body',
      material: 'steel',
      mesh: box([-0.45, 0.1, -0.4], [0.45, 2, 0.34]),
    },
    {
      name: 'kick-plate',
      material: 'trim',
      mesh: box([-0.43, 0, -0.38], [0.43, 0.1, 0.3]),
    },
    {
      name: 'door-lower',
      material: 'steel',
      mesh: box([-0.44, 0.12, 0.34], [0.44, 1.02, 0.37]),
    },
    {
      name: 'door-upper',
      material: 'steel',
      mesh: box([-0.44, 1.06, 0.34], [0.44, 1.98, 0.37]),
    },
    {
      name: 'handles',
      material: 'chrome',
      mesh: merge(
        box([0.33, 0.55, 0.37], [0.36, 0.98, 0.4]),
        box([0.33, 1.1, 0.37], [0.36, 1.6, 0.4]),
      ),
    },
    {
      name: 'display',
      material: 'display',
      mesh: box([-0.3, 1.78, 0.37], [-0.08, 1.88, 0.38]),
    },
  ],
};

/** WOOD_FIRED_OVEN - brick dome on a stone base, 1.8 x 1.6 x 1.8 m. */
const ovenDome = {
  name: 'Wood-fired dome oven',
  materials: {
    stone: {
      colour: [150, 144, 136],
      metallic: 0,
      roughness: 0.9,
    },
    brick: {
      colour: [168, 78, 48],
      metallic: 0,
      roughness: 0.85,
    },
    soot: { colour: [24, 20, 18], metallic: 0, roughness: 1 },
    flue: DARK_STEEL,
  },
  parts: [
    {
      name: 'base',
      material: 'stone',
      mesh: box([-0.9, 0, -0.9], [0.9, 0.8, 0.88]),
    },
    {
      name: 'hearth',
      material: 'stone',
      mesh: box([-0.9, 0.8, -0.9], [0.9, 0.9, 0.9]),
    },
    {
      name: 'dome',
      material: 'brick',
      mesh: dome({
        radiusX: 0.8,
        radiusZ: 0.8,
        height: 0.55,
        y0: 0.9,
        centre: [0, -0.05],
      }),
    },
    {
      name: 'mouth-arch',
      material: 'brick',
      mesh: merge(
        box([-0.32, 0.9, 0.55], [0.32, 1.2, 0.85]),
        cylinder({
          axis: 'z',
          radius: 0.32,
          from: 0.55,
          to: 0.85,
          centre: [0, 1.2],
        }),
      ),
    },
    {
      name: 'mouth-opening',
      material: 'soot',
      mesh: merge(
        box([-0.22, 0.9, 0.85], [0.22, 1.15, 0.87]),
        cylinder({
          axis: 'z',
          radius: 0.22,
          from: 0.85,
          to: 0.87,
          centre: [0, 1.15],
        }),
        box([-0.5, 0.12, 0.88], [0.5, 0.6, 0.885]),
      ),
    },
    {
      name: 'chimney',
      material: 'flue',
      mesh: cylinder({ radius: 0.08, from: 1.3, to: 1.6, centre: [0, -0.35] }),
    },
  ],
};

/** TABLE - work table with legs and a lower shelf, 1.6 x 0.9 x 0.8 m. */
const tablePlain = {
  name: 'Work table',
  materials: {
    surface: { colour: [180, 180, 180], metallic: 0, roughness: 0.7 },
  },
  parts: [
    {
      name: 'top',
      material: 'surface',
      mesh: box([-0.8, 0.86, -0.4], [0.8, 0.9, 0.4]),
    },
    {
      name: 'legs',
      material: 'surface',
      mesh: merge(
        ...[
          [-0.74, -0.34],
          [0.69, -0.34],
          [-0.74, 0.29],
          [0.69, 0.29],
        ].map(([x, z]) => box([x, 0, z], [x + 0.05, 0.86, z + 0.05])),
      ),
    },
    {
      name: 'apron',
      material: 'surface',
      mesh: merge(
        box([-0.69, 0.76, -0.33], [0.69, 0.86, -0.31]),
        box([-0.69, 0.76, 0.31], [0.69, 0.86, 0.33]),
      ),
    },
    {
      name: 'lower-shelf',
      material: 'surface',
      mesh: box([-0.74, 0.15, -0.34], [0.74, 0.18, 0.34]),
    },
  ],
};

/** DEEP_FRYER - fryer cabinet with an oil well and two baskets, 0.5 x 0.9 x 0.7 m. */
const deepFryer = {
  name: 'Deep fryer',
  materials: {
    steel: STEEL,
    oil: { colour: [150, 105, 20], metallic: 0, roughness: 0.05 },
    basket: DARK_STEEL,
    black: BLACK,
  },
  parts: [
    {
      name: 'cabinet',
      material: 'steel',
      mesh: box([-0.25, 0.05, -0.35], [0.25, 0.8, 0.3]),
    },
    { name: 'feet', material: 'basket', mesh: feet(-0.25, 0.25, -0.35, 0.3) },
    {
      name: 'oil-well',
      material: 'oil',
      mesh: box([-0.2, 0.8, -0.18], [0.2, 0.805, 0.2]),
    },
    {
      name: 'baskets',
      material: 'basket',
      mesh: merge(
        box([-0.19, 0.805, -0.12], [-0.02, 0.85, 0.17]),
        box([0.02, 0.805, -0.12], [0.19, 0.85, 0.17]),
      ),
    },
    {
      name: 'basket-handles',
      material: 'black',
      mesh: merge(
        box([-0.12, 0.84, 0.17], [-0.09, 0.86, 0.33]),
        box([0.09, 0.84, 0.17], [0.12, 0.86, 0.33]),
      ),
    },
    {
      name: 'flue',
      material: 'steel',
      mesh: box([-0.22, 0.8, -0.35], [0.22, 0.9, -0.22]),
    },
    {
      name: 'door',
      material: 'steel',
      mesh: box([-0.22, 0.1, 0.3], [0.22, 0.66, 0.315]),
    },
    {
      name: 'knobs',
      material: 'black',
      mesh: knobs([-0.1, 0.1], 0.73, 0.3, 0.05),
    },
  ],
};

/** GRIDDLE - flat-top griddle with a dark cooking plate, 0.9 x 0.9 x 0.7 m. */
const griddle = {
  name: 'Griddle',
  materials: { steel: STEEL, plate: CAST_IRON, trim: DARK_STEEL, black: BLACK },
  parts: [
    {
      name: 'cabinet',
      material: 'steel',
      mesh: box([-0.45, 0.05, -0.35], [0.45, 0.8, 0.3]),
    },
    { name: 'feet', material: 'trim', mesh: feet(-0.45, 0.45, -0.35, 0.3) },
    {
      name: 'plate',
      material: 'plate',
      mesh: box([-0.42, 0.8, -0.3], [0.42, 0.83, 0.27]),
    },
    {
      name: 'splash-guard',
      material: 'steel',
      mesh: merge(
        box([-0.45, 0.8, -0.35], [0.45, 0.9, -0.3]),
        box([-0.45, 0.8, -0.3], [-0.42, 0.86, 0.27]),
        box([0.42, 0.8, -0.3], [0.45, 0.86, 0.27]),
      ),
    },
    {
      name: 'grease-trough',
      material: 'trim',
      mesh: box([-0.42, 0.78, 0.27], [0.42, 0.81, 0.3]),
    },
    {
      name: 'knobs',
      material: 'black',
      mesh: knobs(xs(4, -0.3, 0.3), 0.68, 0.3, 0.05),
    },
  ],
};

/** GRILL - char grill with grate bars over a glowing burner, 0.8 x 0.9 x 0.7 m. */
const grill = {
  name: 'Grill',
  materials: {
    steel: STEEL,
    grate: CAST_IRON,
    embers: { colour: [190, 55, 20], metallic: 0, roughness: 0.9 },
    trim: DARK_STEEL,
    black: BLACK,
  },
  parts: [
    {
      name: 'cabinet',
      material: 'steel',
      mesh: box([-0.4, 0.05, -0.35], [0.4, 0.75, 0.3]),
    },
    { name: 'feet', material: 'trim', mesh: feet(-0.4, 0.4, -0.35, 0.3) },
    {
      name: 'firebox',
      material: 'trim',
      mesh: box([-0.37, 0.75, -0.3], [0.37, 0.77, 0.28]),
    },
    {
      name: 'embers',
      material: 'embers',
      mesh: box([-0.35, 0.77, -0.28], [0.35, 0.78, 0.26]),
    },
    {
      name: 'grate-bars',
      material: 'grate',
      mesh: merge(
        ...xs(14, -0.34, 0.34).map((x) =>
          cylinder({
            axis: 'z',
            radius: 0.008,
            from: -0.29,
            to: 0.27,
            centre: [x, 0.81],
            segments: 8,
          }),
        ),
      ),
    },
    {
      name: 'side-walls',
      material: 'steel',
      mesh: merge(
        box([-0.4, 0.75, -0.35], [0.4, 0.9, -0.3]),
        box([-0.4, 0.75, -0.3], [-0.37, 0.85, 0.3]),
        box([0.37, 0.75, -0.3], [0.4, 0.85, 0.3]),
      ),
    },
    {
      name: 'knobs',
      material: 'black',
      mesh: knobs(xs(3, -0.25, 0.25), 0.65, 0.3, 0.05),
    },
  ],
};

/** DISHWASHER - front-loading dishwasher, 0.6 x 0.85 x 0.6 m. */
const dishwasher = {
  name: 'Dishwasher',
  materials: { steel: STEEL, trim: DARK_STEEL, chrome: CHROME, display: GLASS },
  parts: [
    {
      name: 'body',
      material: 'steel',
      mesh: box([-0.3, 0.08, -0.3], [0.3, 0.85, 0.26]),
    },
    {
      name: 'kick-plate',
      material: 'trim',
      mesh: box([-0.28, 0, -0.28], [0.28, 0.08, 0.24]),
    },
    {
      name: 'door',
      material: 'steel',
      mesh: box([-0.29, 0.1, 0.26], [0.29, 0.72, 0.285]),
    },
    {
      name: 'control-panel',
      material: 'trim',
      mesh: box([-0.29, 0.74, 0.26], [0.29, 0.84, 0.285]),
    },
    {
      name: 'display',
      material: 'display',
      mesh: box([0.08, 0.77, 0.285], [0.24, 0.81, 0.3]),
    },
    {
      name: 'handle',
      material: 'chrome',
      mesh: cylinder({
        axis: 'x',
        radius: 0.012,
        from: -0.22,
        to: 0.22,
        centre: [0.68, 0.287],
        segments: 12,
      }),
    },
  ],
};

/** EXHAUST_HOOD - wall canopy hood with grease filters and a duct, 1.3 x 0.6 x 1.0 m. */
const exhaustHood = {
  name: 'Exhaust hood',
  materials: {
    steel: STEEL,
    filter: DARK_STEEL,
  },
  parts: [
    {
      name: 'filters',
      material: 'filter',
      mesh: box([-0.6, 0, -0.45], [0.6, 0.005, 0.45]),
    },
    {
      name: 'lip',
      material: 'steel',
      mesh: box([-0.65, 0.005, -0.5], [0.65, 0.1, 0.5]),
    },
    {
      name: 'canopy',
      material: 'steel',
      mesh: block([-0.65, 0.65, -0.5, 0.5], [-0.3, 0.3, -0.5, -0.1], 0.1, 0.38),
    },
    {
      name: 'duct',
      material: 'steel',
      mesh: box([-0.15, 0.38, -0.45], [0.15, 0.6, -0.15]),
    },
  ],
};

/** COUNTER - base cabinet counter with three doors, 2.4 x 0.9 x 0.7 m. */
const counter = {
  name: 'Counter',
  materials: { steel: STEEL, trim: DARK_STEEL, chrome: CHROME },
  parts: [
    {
      name: 'cabinet',
      material: 'steel',
      mesh: box([-1.18, 0.1, -0.33], [1.18, 0.86, 0.3]),
    },
    {
      name: 'toe-kick',
      material: 'trim',
      mesh: box([-1.16, 0, -0.31], [1.16, 0.1, 0.25]),
    },
    {
      name: 'worktop',
      material: 'steel',
      mesh: box([-1.2, 0.86, -0.35], [1.2, 0.9, 0.35]),
    },
    {
      name: 'doors',
      material: 'steel',
      mesh: merge(
        ...[-1.17, -0.385, 0.4].map((x) =>
          box([x, 0.13, 0.3], [x + 0.77, 0.83, 0.315]),
        ),
      ),
    },
    {
      name: 'handles',
      material: 'chrome',
      mesh: merge(
        ...[-0.46, 0.325, 1.11].map((x) =>
          box([x, 0.55, 0.315], [x + 0.02, 0.75, 0.335]),
        ),
      ),
    },
  ],
};

/** COOKING_TOOL - wooden pizza peel (round blade at -Z, handle to +Z), 0.35 x 0.03 x 0.9 m. */
const pizzaPeel = {
  name: 'Pizza peel',
  materials: {
    wood: {
      colour: [176, 128, 78],
      metallic: 0,
      roughness: 0.65,
    },
  },
  parts: [
    {
      name: 'blade',
      material: 'wood',
      mesh: merge(
        cylinder({
          radius: 0.175,
          from: 0,
          to: 0.012,
          centre: [0, -0.275],
          segments: 32,
        }),
        box([-0.175, 0, -0.275], [0.175, 0.012, -0.08]),
        block(
          [-0.175, 0.175, -0.08, -0.05],
          [-0.04, 0.04, -0.08, -0.05],
          0,
          0.012,
        ),
      ),
    },
    {
      name: 'handle',
      material: 'wood',
      mesh: cylinder({
        axis: 'z',
        radius: 0.015,
        from: -0.06,
        to: 0.45,
        centre: [0, 0.015],
        segments: 12,
      }),
    },
  ],
};

/** COOKING_TOOL - frying pan with a long handle (+X), 0.55 x 0.06 x 0.3 m. */
const pan = {
  name: 'Frying pan',
  materials: { steel: STEEL, coating: CAST_IRON, black: BLACK },
  parts: [
    {
      name: 'bowl',
      material: 'steel',
      mesh: cylinder({
        radius: 0.13,
        radiusTo: 0.15,
        from: 0,
        to: 0.055,
        centre: [-0.125, 0],
        segments: 32,
      }),
    },
    {
      name: 'cooking-surface',
      material: 'coating',
      mesh: cylinder({
        radius: 0.135,
        from: 0.055,
        to: 0.06,
        centre: [-0.125, 0],
        segments: 32,
      }),
    },
    {
      name: 'handle',
      material: 'black',
      mesh: box([0.02, 0.035, -0.015], [0.275, 0.05, 0.015]),
    },
  ],
};

/** COOKING_TOOL - stock pot with a lid and two side handles, 0.38 x 0.25 x 0.3 m. */
const pot = {
  name: 'Stock pot',
  materials: { steel: STEEL, black: BLACK },
  parts: [
    {
      name: 'body',
      material: 'steel',
      mesh: cylinder({
        radius: 0.15,
        from: 0,
        to: 0.22,
        centre: [0, 0],
        segments: 32,
      }),
    },
    {
      name: 'lid',
      material: 'steel',
      mesh: cylinder({
        radius: 0.15,
        radiusTo: 0.12,
        from: 0.22,
        to: 0.235,
        centre: [0, 0],
        segments: 32,
      }),
    },
    {
      name: 'lid-knob',
      material: 'black',
      mesh: cylinder({
        radius: 0.02,
        from: 0.235,
        to: 0.25,
        centre: [0, 0],
        segments: 12,
      }),
    },
    {
      name: 'handles',
      material: 'black',
      mesh: merge(
        box([-0.19, 0.16, -0.04], [-0.145, 0.185, 0.04]),
        box([0.145, 0.16, -0.04], [0.19, 0.185, 0.04]),
      ),
    },
  ],
};

/** Asset id -> recipe; `type` is the WEB06 element type the model represents. */
export const KITCHEN_MODELS = Object.freeze({
  'AST-MDL-FRIDGE-02': { type: 'REFRIGERATOR', ...fridge },
  'AST-MDL-OVEN-DOME-02': { type: 'WOOD_FIRED_OVEN', ...ovenDome },
  'AST-MDL-TABLE-PLAIN-01': { type: 'TABLE', ...tablePlain },
  'AST-MDL-DEEP-FRYER-01': { type: 'DEEP_FRYER', ...deepFryer },
  'AST-MDL-GRIDDLE-01': { type: 'GRIDDLE', ...griddle },
  'AST-MDL-GRILL-01': { type: 'GRILL', ...grill },
  'AST-MDL-DISHWASHER-01': { type: 'DISHWASHER', ...dishwasher },
  'AST-MDL-EXHAUST-HOOD-01': { type: 'EXHAUST_HOOD', ...exhaustHood },
  'AST-MDL-COUNTER-01': { type: 'COUNTER', ...counter },
  'AST-MDL-PIZZA-PEEL-01': { type: 'COOKING_TOOL', ...pizzaPeel },
  'AST-MDL-PAN-01': { type: 'COOKING_TOOL', ...pan },
  'AST-MDL-POT-01': { type: 'COOKING_TOOL', ...pot },
});