import compact from '../../../../docs/user_stories/web06/samples/kitchen-compact.json';
import extended from '../../../../docs/user_stories/web06/samples/kitchen-extended.json';
import manifest from '../../../../backend/assets/kitchen/manifest.json';
import { parseActiveConfiguration } from '../../../src/visualization/viewer/activeConfigurationParser.js';

function active(content = compact) {
  return {
    id: 'KCF-00002',
    name: 'Kitchen',
    status: 'ACTIVE',
    version: 4,
    content: structuredClone(content),
    assets: Object.fromEntries(
      manifest.assets.map(({ id, kind, format, path }) => [
        id,
        {
          kind,
          format,
          url: `http://localhost:8080/api/v1/kitchen-assets/files/${path}`,
        },
      ]),
    ),
  };
}

test.each([compact, extended])(
  'accepts the WEB06 demonstration layout %# unchanged',
  (content) => {
    const body = active(content);
    expect(parseActiveConfiguration(body)).toBe(body);
  },
);

test.each([
  ['not active', (body) => (body.status = 'INACTIVE')],
  ['schema version', (body) => (body.content.schemaVersion = 2)],
  ['units', (body) => (body.content.units = 'cm')],
  [
    'nonpositive dimensions',
    (body) => (body.content.kitchen.dimensions.width = 0),
  ],
  [
    'nonfinite dimensions',
    (body) => (body.content.kitchen.dimensions.depth = Infinity),
  ],
  ['malformed elements', (body) => (body.content.elements = {})],
  ['missing model', (body) => delete body.assets['AST-MDL-OVEN-DOME-02']],
  [
    'wrong floor map kind',
    (body) =>
      (body.content.kitchen.floor.material.colorMapAssetId =
        'AST-MDL-OVEN-DOME-02'),
  ],
  [
    'missing wall map',
    (body) => (body.content.kitchen.walls.material.colorMapAssetId = 'missing'),
  ],
  [
    'missing element map',
    (body) =>
      (body.content.elements[0].material = { bumpMapAssetId: 'missing' }),
  ],
  ...['data:image/png;base64,AA==', 'javascript:alert(1)', '/oven.glb'].map(
    (url) => [url, (body) => (body.assets['AST-MDL-OVEN-DOME-02'].url = url)],
  ),
])('rejects %s before the files are requested', (_name, change) => {
  const body = active();
  change(body);
  expect(() => parseActiveConfiguration(body)).toThrow();
});

test('rejects a missing response', () => {
  expect(() => parseActiveConfiguration(null)).toThrow();
});
