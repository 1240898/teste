import { readFileSync } from 'node:fs';
import { KitchenLayoutValidator } from '../../../src/modules/kitchen-configuration-management/domain/services/KitchenLayoutValidator.js';
import {
  assetContext,
  sample,
} from '../../helpers/kitchenConfigurationFixtures.js';

const assetsDirectory = new URL('../../../assets/kitchen/', import.meta.url);
const read = (name) => readFileSync(new URL(name, assetsDirectory), 'utf8');

const AC2_TYPES = [
  'TABLE',
  'COUNTER',
  'WOOD_FIRED_OVEN',
  'DEEP_FRYER',
  'GRIDDLE',
  'GRILL',
  'REFRIGERATOR',
  'DISHWASHER',
  'EXHAUST_HOOD',
  'COOKING_TOOL',
];

const equipmentTypes = (layout) =>
  new Set(
    layout.elements
      .filter((element) => element.category === 'EQUIPMENT')
      .map((element) => element.type),
  );

describe('VIS02 kitchen assets and demonstration layouts', () => {
  test('AT01 - every manifest asset is credited with author, source and licence', () => {
    const { assets } = JSON.parse(read('manifest.json'));
    const rows = read('CREDITS.md')
      .split('\n')
      .filter((line) => line.startsWith('| AST-'))
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    const credits = new Map(rows.map((row) => [row[0], row]));
    for (const asset of assets) {
      const row = credits.get(asset.id);
      expect(row).toBeDefined();
      const [, file, title, author, source, licence] = row;
      expect(file).toBe(asset.path);
      for (const cell of [title, author, source, licence])
        expect(cell).not.toBe('');
    }
  });

  test('AT02 - both samples are valid and the extended one has every AC 2 type', () => {
    const validator = new KitchenLayoutValidator();
    for (const name of ['compact', 'extended'])
      expect(validator.validate(sample(name), assetContext()).issues).toEqual(
        [],
      );
    const compact = sample('compact');
    const extended = sample('extended');
    expect(equipmentTypes(extended)).toEqual(new Set(AC2_TYPES));
    expect(compact.kitchen.dimensions).not.toEqual(extended.kitchen.dimensions);
    expect(compact.assemblyLine.wall).not.toBe(extended.assemblyLine.wall);
  });

  // usVIS02 3.8.2: the demonstration layouts as designed (MT01, MT02).
  const DESIGN = {
    compact: {
      wall: 'NORTH',
      elements: 14,
      equipment: {
        'fridge-1': 'AST-MDL-FRIDGE-02',
        'table-1': 'AST-MDL-TABLE-PLAIN-01',
        'tool-peel-1': 'AST-MDL-PIZZA-PEEL-01',
        'griddle-1': 'AST-MDL-GRIDDLE-01',
        'hood-1': 'AST-MDL-EXHAUST-HOOD-01',
        'counter-1': 'AST-MDL-COUNTER-01',
      },
    },
    extended: {
      wall: 'SOUTH',
      elements: 24,
      equipment: {
        'fridge-1': 'AST-MDL-FRIDGE-02',
        'fridge-2': 'AST-MDL-FRIDGE-02',
        'dishwasher-1': 'AST-MDL-DISHWASHER-01',
        'counter-1': 'AST-MDL-COUNTER-01',
        'stone-oven-1': 'AST-MDL-OVEN-DOME-02',
        'table-1': 'AST-MDL-TABLE-PLAIN-01',
        'table-2': 'AST-MDL-TABLE-PLAIN-01',
        'tool-peel-1': 'AST-MDL-PIZZA-PEEL-01',
        'tool-pan-1': 'AST-MDL-PAN-01',
        'tool-pot-1': 'AST-MDL-POT-01',
        'fryer-1': 'AST-MDL-DEEP-FRYER-01',
        'griddle-1': 'AST-MDL-GRIDDLE-01',
        'grill-1': 'AST-MDL-GRILL-01',
        'hood-1': 'AST-MDL-EXHAUST-HOOD-01',
      },
    },
  };

  test.each(Object.keys(DESIGN))(
    'AT03 - the %s sample follows usVIS02 3.8.2 (line wall, elements, models)',
    (name) => {
      const layout = sample(name);
      const design = DESIGN[name];
      expect(layout.assemblyLine.wall).toBe(design.wall);
      expect(layout.elements).toHaveLength(design.elements);
      const equipment = Object.fromEntries(
        layout.elements
          .filter((element) => element.category === 'EQUIPMENT')
          .map((element) => [element.id, element.model.assetId]),
      );
      expect(equipment).toEqual(design.equipment);
    },
  );
});