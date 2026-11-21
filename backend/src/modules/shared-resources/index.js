import { constants } from 'node:fs';
import { open, readdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { raw, Router } from 'express';
import { AppError } from '../../shared/errors/AppError.js';
import { RoleMiddleware } from '../authorization-enforcement/api/middlewares/RoleMiddleware.js';
import { createSharedResourceAudit } from './audit.js';
import {
  findDocument,
  isDocumentName,
  publishDocument,
  UPLOAD_LIMIT,
  validatePublication,
} from './documentStore.js';

const FILE_READ_FLAGS =
  constants.O_RDONLY |
  (constants.O_NOFOLLOW ?? 0) |
  (constants.O_NONBLOCK ?? 0);

async function openDocument(directory, name) {
  if (!isDocumentName(name))
    throw new AppError('Shared document not found', 404);
  const path = join(directory, name);
  try {
    const entry = await findDocument(path);
    return { file: await open(path, FILE_READ_FLAGS), entry };
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code))
      throw new AppError('Shared document not found', 404);
    throw error;
  }
}

export function createSharedResourcesModule({
  authMiddleware,
  directory = process.env.SHARED_RESOURCES_DIRECTORY ||
    '/data/shared-resources',
  auditPath = process.env.SHARED_RESOURCES_AUDIT_PATH ||
    '/var/log/shared-resources/access.jsonl',
  writeDocument = publishDocument,
}) {
  const root = resolve(directory);
  const router = Router();
  const audit = createSharedResourceAudit(resolve(auditPath));
  const { verifyToken } = authMiddleware;
  const manage = RoleMiddleware.requireOperation('sharedResources.manage');
  const upload = raw({
    type: 'application/octet-stream',
    limit: UPLOAD_LIMIT,
    inflate: false,
  });
  let mutations = Promise.resolve();

  function mutate(req, res, successStatus, operation) {
    const recordResult = audit.beginMutation(res);
    const result = mutations.then(async () => {
      try {
        const authorized = () => {};
        // A queued request may outlive its original permissions or session.
        await verifyToken(req, res, authorized);
        manage(req, res, authorized);
        await operation();
        recordResult(successStatus);
      } catch (error) {
        recordResult(error instanceof AppError ? error.status : 500);
        throw error;
      }
    });
    mutations = result.catch(() => {});
    return result;
  }

  router.get('/', audit.track('LIST'), verifyToken, async (_req, res) => {
    const entries = await readdir(root, { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isFile() && isDocumentName(entry.name))
      .map((entry) => entry.name)
      .sort();
    res.json({ items: names.map((name) => ({ name })) });
  });

  router.get(
    '/:name',
    audit.track('DOWNLOAD'),
    verifyToken,
    async (req, res) => {
      const { name } = req.params;
      const { file, entry } = await openDocument(root, name);
      try {
        const current = await file.stat();
        // Serve only the regular file identified before opening it.
        if (
          !current.isFile() ||
          current.dev !== entry.dev ||
          current.ino !== entry.ino
        )
          throw new AppError('Shared document not found', 404);

        res.attachment(name).set({
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(current.size),
          'X-Content-Type-Options': 'nosniff',
        });
        if (req.method === 'HEAD') return res.end();
        await pipeline(file.createReadStream({ autoClose: false }), res);
      } catch (error) {
        // Pipeline may already have terminated the response on a failed transfer.
        if (!res.destroyed) throw error;
      } finally {
        await file.close();
      }
    },
  );

  router.post(
    '/:name',
    audit.track('PUBLISH'),
    verifyToken,
    manage,
    validatePublication,
    upload,
    async (req, res) => {
      const { name } = req.params;
      await mutate(req, res, 201, () =>
        writeDocument(root, name, req.body, { replace: false }),
      );
      res
        .location(`${req.baseUrl}/${encodeURIComponent(name)}`)
        .status(201)
        .json({ name });
    },
  );

  router.put(
    '/:name',
    audit.track('REPLACE'),
    verifyToken,
    manage,
    validatePublication,
    upload,
    async (req, res) => {
      await mutate(req, res, 204, () =>
        writeDocument(root, req.params.name, req.body, { replace: true }),
      );
      res.sendStatus(204);
    },
  );

  router.delete(
    '/:name',
    audit.track('DELETE'),
    verifyToken,
    manage,
    async (req, res) => {
      const { name } = req.params;
      if (!isDocumentName(name))
        throw new AppError('Shared document not found', 404);
      const target = join(root, name);
      await mutate(req, res, 204, async () => {
        await findDocument(target);
        await unlink(target);
      });
      res.sendStatus(204);
    },
  );

  return {
    router,
    async flushAudit() {
      await mutations;
      await audit.flush();
    },
  };
}

export function register(router, module) {
  if (module) router.use('/shared-resources', module.router);
}
