import { compareConfigurations } from '../../src/features/kitchen-configurations/compareConfigurations.js';
import { layout } from './kitchenTestUtils.jsx';

const record = (name, content) => ({ name, content });

describe('WEB06 compareConfigurations (FT12)', () => {
  test('one change per path, elements matched by id', () => {
    const from = record('Compact kitchen', layout());
    const content = layout();
    content.kitchen.dimensions.width = 14;
    content.elements = content.elements.filter((item) => item.id !== 'table-1');
    content.elements[0].placement.position.x = 0.5;
    content.elements.push({ id: 'table-3', placement: {} });
    const { changes } = compareConfigurations(
      from,
      record('Kitchen B', content),
    );
    expect(changes.map(({ path, kind }) => [path, kind])).toEqual([
      ['/name', 'set'],
      ['/content/kitchen/dimensions/width', 'set'],
      ['/content/elements[line-arm-2]/placement/position/x', 'set'],
      ['/content/elements[table-1]', 'remove'],
      ['/content/elements[table-3]', 'add'],
    ]);
    expect(changes[1]).toMatchObject({ before: 12, after: 14 });
  });

  test('no change for identical records; reordering elements is not a change', () => {
    const content = layout();
    const reordered = layout({ elements: [...layout().elements].reverse() });
    expect(
      compareConfigurations(record('A', content), record('A', reordered))
        .changes,
    ).toEqual([]);
  });
});