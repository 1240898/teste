/** Same limit as the back-end request body (D10). */
export const MAX_IMPORT_BYTES = 100 * 1024;

function positionToLineColumn(text, position) {
  const before = text.slice(0, position);
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

/**
 * Syntax check before anything is sent (BR 4). Returns
 * { ok: true, value } or { ok: false, error: { code, line, column, message } }
 * where code is "empty", "syntax" or "notObject".
 */
export function parseConfigurationText(text) {
  if (typeof text !== 'string' || !text.trim())
    return {
      ok: false,
      error: { code: 'empty', line: null, column: null, message: 'Empty JSON' },
    };
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = String(error?.message ?? 'Invalid JSON');
    const lineColumn = /line (\d+) column (\d+)/i.exec(message);
    const position = /position (\d+)/i.exec(message);
    const location = lineColumn
      ? { line: Number(lineColumn[1]), column: Number(lineColumn[2]) }
      : position
        ? positionToLineColumn(text, Number(position[1]))
        : { line: null, column: null };
    return { ok: false, error: { code: 'syntax', ...location, message } };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return {
      ok: false,
      error: {
        code: 'notObject',
        line: null,
        column: null,
        message: 'The configuration must be a JSON object',
      },
    };
  return { ok: true, value };
}

export function formatConfiguration(value) {
  return JSON.stringify(value, null, 2);
}

export class ImportFileError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ImportFileError';
    this.code = code; // "extension" | "size" | "read"
  }
}

function readAsText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Client-side import (D10): only ".json" files of at most 100 KB. It never
 * sends anything; the text is shown in the editor and stored only on "Save".
 * @returns {Promise<{ suggestedName: string, text: string }>}
 */
export async function readImportFile(file) {
  const name = typeof file?.name === 'string' ? file.name : '';
  if (!/\.json$/i.test(name)) throw new ImportFileError('extension');
  if (typeof file.size !== 'number' || file.size > MAX_IMPORT_BYTES)
    throw new ImportFileError('size');
  let text;
  try {
    text = await readAsText(file);
  } catch {
    throw new ImportFileError('read');
  }
  return { suggestedName: name.replace(/\.json$/i, ''), text };
}