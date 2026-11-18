import {
  applyResolutions,
  rebaseDraft,
} from '../../src/features/kitchen-configurations/rebaseDraft.js';
import { layout } from './kitchenTestUtils.jsx';

const base = { name: 'Compact kitchen', content: layout() };
const draft = (mutate, name = base.name) => {
  const content = layout();
  mutate?.(content);
  return { name, text: JSON.stringify(content) };
};
const latest = (mutate, name = base.name) => {
  const content = layout();
  mutate?.(content);
  return { name, content, version: 4 };
};
const element = (content, id) =>
  content.elements.find((item) => item.id === id);

describe('WEB06 rebaseDraft (FT13)', () => {
  test('(a) other changed the dimensions, mine the name -> both, no conflict', () => {
    const result = rebaseDraft(
      base,
      draft(null, 'Kitchen B'),
      latest((c) => (c.kitchen.dimensions.width = 14)),
    );
    expect(result.conflicts).toEqual([]);
    expect(result.candidate.name).toBe('Kitchen B');
    expect(result.candidate.content.kitchen.dimensions.width).toBe(14);
    expect(result.applied.map((change) => change.path)).toEqual(['/name']);
    expect(result.theirs.map((change) => change.path)).toEqual([
      '/content/kitchen/dimensions/width',
    ]);
  });

  test('(b) both changed line-arm-2 x differently -> one conflict', () => {
    const result = rebaseDraft(
      base,
      draft((c) => (element(c, 'line-arm-2').placement.position.x = 0.3)),
      latest((c) => (element(c, 'line-arm-2').placement.position.x = 0.7)),
    );
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        path: '/content/elements[line-arm-2]/placement/position/x',
        base: 0,
        mine: 0.3,
        theirs: 0.7,
      }),
    ]);
    const theirs = applyResolutions(result, {
      [result.conflicts[0].path]: 'theirs',
    });
    expect(
      element(theirs.candidate.content, 'line-arm-2').placement.position.x,
    ).toBe(0.7);
    const mine = applyResolutions(result, {
      [result.conflicts[0].path]: 'mine',
    });
    expect(
      element(mine.candidate.content, 'line-arm-2').placement.position.x,
    ).toBe(0.3);
    expect(mine.unresolved).toBe(0);
    expect(applyResolutions(result, {}).unresolved).toBe(1);
  });

  test('(c) both changed it to the same value -> no conflict', () => {
    const move = (c) => (element(c, 'line-arm-2').placement.position.x = 0.7);
    const result = rebaseDraft(base, draft(move), latest(move));
    expect(result.conflicts).toEqual([]);
    expect(result.applied).toEqual([]);
  });

  test('(d) other removed fridge-2, mine moved it -> conflict; keep mine restores it', () => {
    const result = rebaseDraft(
      base,
      draft((c) => (element(c, 'fridge-2').placement.position.x = -4)),
      latest(
        (c) =>
          (c.elements = c.elements.filter((item) => item.id !== 'fridge-2')),
      ),
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].theirs).toBeUndefined();
    const mine = applyResolutions(result, {
      [result.conflicts[0].path]: 'mine',
    });
    expect(
      element(mine.candidate.content, 'fridge-2').placement.position.x,
    ).toBe(-4);
  });

  test('(e) mine added table-3 -> appended after latest elements', () => {
    const result = rebaseDraft(
      base,
      draft((c) => c.elements.push({ id: 'table-3', placement: {} })),
      latest((c) => c.elements.push({ id: 'table-9', placement: {} })),
    );
    expect(result.candidate.content.elements.map((item) => item.id)).toEqual([
      'line-arm-2',
      'fridge-2',
      'table-1',
      'table-9',
      'table-3',
    ]);
  });

  test('(f) mine removed table-1, other did not change it -> removed', () => {
    const result = rebaseDraft(
      base,
      draft(
        (c) =>
          (c.elements = c.elements.filter((item) => item.id !== 'table-1')),
      ),
      latest(),
    );
    expect(element(result.candidate.content, 'table-1')).toBeUndefined();
  });

  test('(g) a draft that does not parse cannot be rebased', () => {
    expect(
      rebaseDraft(base, { name: 'x', text: '{ "a": ' }, latest()).status,
    ).toBe('rebase-impossible');
  });
});