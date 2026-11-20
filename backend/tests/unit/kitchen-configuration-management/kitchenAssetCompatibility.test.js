import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { kitchenModelGlb } from '../../../scripts/kitchen-models/index.js';
import { KitchenAsset } from '../../../src/modules/kitchen-configuration-management/domain/model/KitchenAsset.js';
import { KitchenLayoutValidator } from '../../../src/modules/kitchen-configuration-management/domain/services/KitchenLayoutValidator.js';
import { GltfModelInspector } from '../../../src/modules/kitchen-configuration-management/infrastructure/files/GltfModelInspector.js';
import { sample } from '../../helpers/kitchenConfigurationFixtures.js';

/**
 * Regression (VIS02 review): the catalogue that `npm run db:seed` builds from
 * the SHIPPED files must keep accepting the layouts that were valid before the
 * VIS02 models were added. WEB06 revalidates a saved layout when it is
 * activated, so a changed contract of an existing asset id (size or embedded
 * texture set) would make those kitchens impossible to activate.
 */
const assetsDirectory = new URL('../../../assets/kitchen/', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', assetsDirectory), 'utf8'),
).assets;
const previousLayout = (name) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../fixtures/kitchen-layouts/previous-${name}.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  );

/** Same catalogue as the seed: every manifest entry, models inspected from their file. */
async function shippedCatalogue() {
  const inspector = new GltfModelInspector();
  const context = new Map();
  for (const entry of manifest) {
    const file = fileURLToPath(new URL(`files/${entry.path}`, assetsDirectory));
    const inspected =
      entry.kind === 'MODEL' ? await inspector.inspect(file) : {};
    context.set(entry.id, {
      asset: new KitchenAsset({ ...entry, ...inspected }),
      fileAvailable: true,
    });
  }
  return context;
}

describe('VIS02 asset compatibility with existing layouts', () => {
  let context;
  beforeAll(async () => {
    context = await shippedCatalogue();
  });

  test.each(['compact', 'extended'])(
    'CP01 - the previously valid %s layout is still valid against the shipped catalogue',
    (name) => {
      const { issues } = new KitchenLayoutValidator().validate(
        previousLayout(name),
        context,
      );
      expect(issues).toEqual([]);
    },
  );

  test.each(['compact', 'extended'])(
    'CP02 - the current %s sample is valid against the shipped catalogue',
    (name) => {
      const { issues } = new KitchenLayoutValidator().validate(
        sample(name),
        context,
      );
      expect(issues).toEqual([]);
    },
  );

  test('CP03 - the ids used before keep their contract (size and texture set)', () => {
    const contract = (id) => {
      const { size, embeddedTextureSet } = context.get(id).asset;
      return { size, embeddedTextureSet };
    };
    expect(contract('AST-MDL-FRIDGE-01')).toEqual({
      size: { x: 0.9, y: 2, z: 0.8 },
      embeddedTextureSet: true,
    });
    expect(contract('AST-MDL-OVEN-DOME-01')).toEqual({
      size: { x: 1.8, y: 1.6, z: 1.8 },
      embeddedTextureSet: true,
    });
    expect(contract('AST-MDL-TABLE-PLAIN-01')).toEqual({
      size: { x: 1.6, y: 0.9, z: 0.8 },
      embeddedTextureSet: false,
    });
  });
});

test.each([
  ['AST-MDL-DISPENSER-02', ['housing', 'release-gate']],
  ['AST-MDL-CONVEYOR-02', ['belt-surface']],
  [
    'AST-MDL-ROBOT-ARM-02',
    ['base', 'base-yaw', 'shoulder', 'elbow', 'end-effector', 'release-gate'],
  ],
  ['AST-MDL-OVEN-LINE-01', ['hearth']],
])(
  'VIS03 - %s can be regenerated and preserves its textured part hierarchy',
  async (id, parts) => {
    const { path } = manifest.find((entry) => entry.id === id);
    const file = new URL(`files/${path}`, assetsDirectory);
    const bytes = readFileSync(file);
    expect(kitchenModelGlb(id).equals(bytes)).toBe(true);
    const gltf = JSON.parse(
      bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)),
    );
    let candidates = gltf.scenes[gltf.scene].nodes;
    for (const name of parts) {
      const part = candidates
        .map((index) => gltf.nodes[index])
        .find((node) => node.name === name);
      expect(part).toBeDefined();
      candidates = part.children ?? [];
    }
    const inspector = new GltfModelInspector();
    expect(
      (await inspector.inspect(fileURLToPath(file))).embeddedTextureSet,
    ).toBe(true);
  },
);
