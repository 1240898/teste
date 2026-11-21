import {
  DEFAULTS,
  parse,
} from '../../../../src/visualization/scene/materials/MaterialParser.js';
import { MaterialBuildError } from '../../../../src/visualization/scene/materials/MaterialBuildError.js';

const textureSet = {
  colorMapAssetId: 'AST-TEX-WOOD-COLOR',
  normalMapAssetId: 'AST-TEX-WOOD-NORMAL',
};

const failure = (properties, options) => {
  try {
    parse(properties, options);
  } catch (error) {
    return error;
  }
  throw new Error('parse() did not fail');
};

test('T1 - returns every valid field unchanged', () => {
  const properties = {
    ...textureSet,
    roughnessMapAssetId: 'AST-TEX-WOOD-ROUGH',
    bumpMapAssetId: 'AST-TEX-WOOD-BUMP',
    color: '#8B5E3C',
    roughness: 0.72,
    metalness: 0.05,
  };
  expect(parse(properties)).toEqual(properties);
});

test('T2 - fills the defaults of a required material that has only maps', () => {
  expect(parse(textureSet)).toEqual({ ...textureSet, ...DEFAULTS });
  expect(DEFAULTS).toEqual({ color: '#ffffff', roughness: 1, metalness: 0 });
});

test.each([
  ['roughness', 1.2],
  ['metalness', -0.1],
  ['roughness', Number.NaN],
  ['metalness', '0.5'],
])('T3 - rejects %s = %p as invalid-range', (property, value) => {
  const error = failure({ ...textureSet, [property]: value });
  expect(error).toBeInstanceOf(MaterialBuildError);
  expect(error).toMatchObject({ property, reason: 'invalid-range' });
});

test.each(['brown', '#abc', '#12345g', 0xffffff])(
  'T4 - rejects color %p as invalid-color',
  (color) => {
    expect(failure({ ...textureSet, color })).toMatchObject({
      property: 'color',
      reason: 'invalid-color',
    });
  },
);

test.each([undefined, {}, { roughness: 0.5 }, { normalMapAssetId: 'n' }])(
  'T5 - a required material without colour map is incomplete (%p)',
  (properties) => {
    expect(failure(properties, { required: true })).toMatchObject({
      property: 'colorMapAssetId',
      reason: 'incomplete-maps',
    });
  },
);

test('T6 - a required material with only the colour map is incomplete', () => {
  expect(
    failure({ colorMapAssetId: 'c' }, { required: true }),
  ).toMatchObject({ reason: 'incomplete-maps' });
});

test.each([{ colorMapAssetId: 'c' }, { roughnessMapAssetId: 'r' }])(
  'T7 - an override with some maps but no complete set is rejected (%p)',
  (properties) => {
    expect(failure(properties, { required: false })).toMatchObject({
      reason: 'incomplete-maps',
    });
  },
);

test('T8 - a scalar-only override is valid and its absent scalars are not filled', () => {
  expect(parse({ color: '#aa0000' }, { required: false })).toEqual({
    color: '#aa0000',
  });
});

test('T35 - an override with a complete texture set gets the defaults', () => {
  expect(parse(textureSet, { required: false })).toEqual({
    ...textureSet,
    ...DEFAULTS,
  });
});

test('ignores keys that WEB06 does not accept and never mutates the input', () => {
  const properties = Object.freeze({ ...textureSet, opacity: 0.5 });
  const dto = parse(properties);
  expect(dto).not.toHaveProperty('opacity');
  expect(Object.isFrozen(dto)).toBe(true);
});