import { randomUUID } from 'node:crypto';
import { link, lstat, rename, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { AppError } from '../../shared/errors/AppError.js';

export const UPLOAD_LIMIT = 10 * 1024 * 1024;
const supportedExtensions = new Set(['.pdf', '.docx', '.txt']);

export function isDocumentName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    Buffer.byteLength(name, 'utf8') <= 255 &&
    !name.startsWith('.') &&
    !/[<>:"/\\|?*\p{Cc}]/u.test(name) &&
    !/[ .]$/u.test(name) &&
    supportedExtensions.has(extname(name).toLowerCase())
  );
}

export async function findDocument(path) {
  try {
    const entry = await lstat(path);
    if (entry.isFile()) return entry;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  throw new AppError('Shared document not found', 404);
}

export function validatePublication(req, _res, next) {
  const { name } = req.params;
  if (!isDocumentName(name))
    throw new AppError(
      'Choose a PDF, DOCX or TXT document with a valid filename',
      400,
    );
  if (req.get('X-Confirm-Shared-Publication') !== 'true')
    throw new AppError(
      'Confirm that the document may be shared with all active users',
      400,
    );
  if (!req.is('application/octet-stream'))
    throw new AppError('Expected application/octet-stream', 415);
  next();
}

export async function publishDocument(directory, name, content, { replace }) {
  if (!Buffer.isBuffer(content) || content.length === 0)
    throw new AppError('Choose a non-empty document', 400);

  const target = join(directory, name);
  const temporary = join(directory, `.upload-${randomUUID()}`);
  try {
    await writeFile(temporary, content, {
      flag: 'wx',
      mode: 0o640,
      flush: true,
    });
    if (replace) {
      await findDocument(target);
      await rename(temporary, target);
    } else {
      await link(temporary, target);
    }
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new AppError(
        'A shared document with this name already exists',
        409,
      );
    throw error;
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT')
        console.error('SYS04: could not remove a temporary upload');
    });
  }
}
