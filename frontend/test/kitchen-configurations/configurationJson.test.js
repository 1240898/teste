import {
  MAX_IMPORT_BYTES,
  parseConfigurationText,
  readImportFile,
} from '../../src/features/kitchen-configurations/configurationJson.js';

const file = (name, text, size = text.length) => ({
  name,
  size,
  text: async () => text,
});

describe('WEB06 configurationJson', () => {
  test('FT01 - syntax error reports line and column', () => {
    const lines = Array.from(
      { length: 13 },
      (_, index) => `  "k${index}": ${index},`,
    );
    const text = `{\n${lines.join('\n')}\n}`;
    const result = parseConfigurationText(text);
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'syntax', line: 15 });
    expect(result.error.column).toEqual(expect.any(Number));
  });

  test('FT01 - top level must be an object', () => {
    expect(parseConfigurationText('[]').error.code).toBe('notObject');
    expect(parseConfigurationText('"text"').error.code).toBe('notObject');
    expect(parseConfigurationText('  ').error.code).toBe('empty');
    expect(parseConfigurationText('{"schemaVersion": 1}')).toEqual({
      ok: true,
      value: { schemaVersion: 1 },
    });
  });

  test('FT02 - import accepts only .json files up to 100 KB', async () => {
    await expect(
      readImportFile(file('layout.txt', '{}')),
    ).rejects.toMatchObject({
      code: 'extension',
    });
    await expect(
      readImportFile(file('big.json', '{}', 150 * 1024)),
    ).rejects.toMatchObject({ code: 'size' });
    expect(MAX_IMPORT_BYTES).toBe(102400);
    await expect(
      readImportFile(file('kitchen-a.json', '{"a":1}')),
    ).resolves.toEqual({
      suggestedName: 'kitchen-a',
      text: '{"a":1}',
    });
  });
});