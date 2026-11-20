import { box, block, cylinder, dome, merge, MeshData } from './geometry.js';
import { KITCHEN_MODELS } from './models.js';

const steelMaps = {
  colourMap: 'steel-color.png',
  normalMap: 'steel-normal.png',
};
const masonryMaps = {
  colourMap: 'tiles-color.png',
  normalMap: 'tiles-normal.png',
};
const steel = {
  ...steelMaps,
  colour: [220, 230, 235],
  metallic: 0.55,
  roughness: 0.42,
};
const dark = {
  ...steelMaps,
  colour: [62, 68, 75],
  metallic: 0.1,
  roughness: 0.8,
};
const orange = {
  ...steelMaps,
  colour: [240, 142, 38],
  metallic: 0.2,
  roughness: 0.48,
};

const dispenser = {
  name: 'Overhead crust dispenser',
  materials: { steel, dark },
  parts: [
    {
      name: 'housing',
      material: 'steel',
      mesh: merge(
        block([-0.22, 0.22, -0.23, 0.23], [-0.3, 0.3, -0.3, 0.3], 0.23, 0.8),
        box([-0.22, 0.035, -0.23], [-0.18, 0.23, 0.23]),
        box([0.18, 0.035, -0.23], [0.22, 0.23, 0.23]),
        box([-0.18, 0.035, -0.23], [0.18, 0.23, -0.18]),
      ),
    },
    {
      name: 'release-gate',
      parent: 'housing',
      translation: [0, 0.035, -0.18],
      material: 'dark',
      mesh: box([-0.18, -0.035, 0], [0.18, 0, 0.36]),
    },
  ],
};

function conveyorSurface() {
  const treads = Array.from({ length: 10 }, (_, index) => {
    const x = -0.5 + index * 0.1;
    return box([x, 0.094, -0.25], [x + 0.026, 0.1, 0.25]);
  });
  const surface = merge(
    box([-0.5, 0.07, -0.26], [0.5, 0.094, 0.26]),
    ...treads,
    box([0.474, 0.094, -0.25], [0.5, 0.1, 0.25]),
  );
  for (let vertex = 0; vertex < surface.positions.length / 3; vertex += 1) {
    surface.uvs[vertex * 2] = 10 * (surface.positions[vertex * 3] + 0.5);
    surface.uvs[vertex * 2 + 1] =
      (surface.positions[vertex * 3 + 2] + 0.26) / 0.52;
  }
  return surface;
}

const conveyor = {
  name: 'Pizza conveyor belt',
  materials: { steel, dark },
  parts: [
    {
      name: 'frame',
      material: 'steel',
      mesh: merge(
        box([-0.495, 0, -0.27], [0.495, 0.07, 0.27]),
        box([-0.495, 0.02, -0.3], [0.495, 0.085, -0.264]),
        box([-0.495, 0.02, 0.264], [0.495, 0.085, 0.3]),
      ),
    },
    { name: 'belt-surface', material: 'dark', mesh: conveyorSurface() },
  ],
};

/** A link from a joint origin to the next joint in the local YZ plane. */
function armLink(y, z, width, depth = width) {
  const length = Math.hypot(y, z);
  const cos = y / length;
  const sin = z / length;
  const mesh = box([-width / 2, 0, -depth / 2], [width / 2, length, depth / 2]);
  for (const vectors of [mesh.positions, mesh.normals]) {
    for (let i = 0; i < vectors.length; i += 3) {
      const localY = vectors[i + 1];
      const localZ = vectors[i + 2];
      vectors[i + 1] = cos * localY - sin * localZ;
      vectors[i + 2] = sin * localY + cos * localZ;
    }
  }
  return mesh;
}

const hinge = (radius, halfWidth) =>
  cylinder({
    axis: 'x',
    radius,
    from: -halfWidth,
    to: halfWidth,
    centre: [0, 0],
  });

const arm = {
  name: 'Articulated ingredient dispenser arm',
  materials: { steel, dark, orange },
  parts: [
    {
      name: 'base',
      material: 'dark',
      mesh: box([-0.2, 0, -0.13], [0.2, 0.08, 0.13]),
    },
    {
      name: 'base-yaw',
      parent: 'base',
      translation: [0, 0.08, 0],
      material: 'steel',
      mesh: cylinder({ radius: 0.11, from: 0, to: 0.18, centre: [0, 0] }),
    },
    {
      name: 'shoulder',
      parent: 'base-yaw',
      translation: [0, 0.18, 0],
      material: 'orange',
      mesh: merge(hinge(0.1, 0.14), armLink(0.65, 0.19, 0.14)),
    },
    {
      name: 'elbow',
      parent: 'shoulder',
      translation: [0, 0.65, 0.19],
      material: 'orange',
      mesh: merge(hinge(0.085, 0.115), armLink(-0.55, 0.26, 0.1, 0.04)),
    },
    {
      name: 'end-effector',
      parent: 'elbow',
      translation: [0, -0.55, 0.26],
      material: 'steel',
      mesh: cylinder({
        radius: 0.02,
        radiusTo: 0.018,
        from: 0.045,
        to: -0.075,
        centre: [0, 0],
      }),
    },
    {
      name: 'release-gate',
      parent: 'end-effector',
      translation: [0, -0.075, -0.015],
      material: 'dark',
      mesh: box([-0.016, -0.01, 0], [0.016, 0, 0.03]),
    },
  ],
};

/** Extruded arch. The inner surface faces the open passage. */
function ovenArch() {
  const mesh = new MeshData();
  const back = 0.43;
  const front = 0.9;
  const spring = 1.08;
  const segments = 20;
  for (let i = 0; i < segments; i += 1) {
    const angles = [i, i + 1].map((step) => (step * Math.PI) / segments);
    const section = (radius, z) =>
      angles.map((angle) => [
        radius * Math.cos(angle),
        spring + radius * Math.sin(angle),
        z,
      ]);
    const [inFrontA, inFrontB] = section(0.35, front);
    const [outFrontA, outFrontB] = section(0.44, front);
    const [inBackA, inBackB] = section(0.35, back);
    const [outBackA, outBackB] = section(0.44, back);
    mesh.quad([inFrontA, inFrontB, outFrontB, outFrontA], inBackA);
    mesh.quad([inBackA, inBackB, outBackB, outBackA], inFrontA);
    mesh.quad([inFrontA, inFrontB, inBackB, inBackA], outFrontA);
    mesh.quad([outFrontA, outFrontB, outBackB, outBackA], inFrontA);
  }
  return merge(
    mesh,
    box([-0.44, 1, back], [-0.35, spring, front]),
    box([0.35, 1, back], [0.44, spring, front]),
  );
}

function fireboxBack() {
  const mesh = new MeshData();
  const z = 0.46;
  const normal = [0, 0, 1];
  const centre = mesh.vertex([0, 1.08, z], normal, [0.5, 0]);
  let previous;
  for (let step = 0; step <= 20; step += 1) {
    const angle = (step * Math.PI) / 20;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const current = mesh.vertex([x * 0.35, 1.08 + y * 0.35, z], normal, [
      (x + 1) / 2,
      y,
    ]);
    if (previous !== undefined)
      mesh.triangle(centre, previous, current, normal);
    previous = current;
  }
  mesh.quad(
    [
      [-0.35, 1, z],
      [0.35, 1, z],
      [0.35, 1.08, z],
      [-0.35, 1.08, z],
    ],
    [0, 1, z - 0.01],
  );
  return mesh;
}

const equipmentOven = KITCHEN_MODELS['AST-MDL-OVEN-DOME-02'];
const oven = {
  name: 'Wood-fired dome oven with conveyor intake',
  materials: {
    stone: { ...equipmentOven.materials.stone, ...masonryMaps },
    brick: { ...equipmentOven.materials.brick, ...masonryMaps },
    soot: { ...equipmentOven.materials.soot, ...masonryMaps },
    flue: dark,
  },
  parts: [
    equipmentOven.parts.find(({ name }) => name === 'base'),
    {
      name: 'hearth',
      material: 'stone',
      mesh: box([-0.9, 0.8, -0.9], [0.9, 1, 0.9]),
    },
    {
      name: 'dome',
      material: 'brick',
      mesh: dome({
        radiusX: 0.8,
        radiusZ: 0.66,
        height: 0.49,
        y0: 1,
        centre: [0, -0.22],
      }),
    },
    { name: 'intake-arch', material: 'brick', mesh: ovenArch() },
    {
      name: 'firebox-back',
      material: 'soot',
      mesh: fireboxBack(),
    },
    equipmentOven.parts.find(({ name }) => name === 'chimney'),
  ],
};

export const ASSEMBLY_LINE_MODELS = {
  'AST-MDL-DISPENSER-02': dispenser,
  'AST-MDL-CONVEYOR-02': conveyor,
  'AST-MDL-ROBOT-ARM-02': arm,
  'AST-MDL-OVEN-LINE-01': oven,
};
