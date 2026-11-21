import { appendFile } from 'node:fs/promises';
import { isDocumentName } from './documentStore.js';

export function createSharedResourceAudit(path) {
  let pending = Promise.resolve();

  function record(event) {
    pending = pending
      .then(() =>
        appendFile(path, `${JSON.stringify(event)}\n`, {
          mode: 0o600,
          flush: true,
        }),
      )
      .catch(() =>
        console.error('SYS04 audit file unavailable', JSON.stringify(event)),
      );
  }

  function track(operation) {
    return (req, res, next) => {
      const { name } = req.params;
      const document = isDocumentName(name) ? name : null;
      let mutationStarted = false;
      function recordResult(statusCode, resultSource) {
        const outcome =
          statusCode === null
            ? 'ABORTED'
            : statusCode >= 500
              ? 'ERROR'
              : statusCode >= 400
                ? 'DENIED'
                : 'SUCCESS';
        record({
          timestamp: new Date().toISOString(),
          operation,
          document,
          actorId: req.user?.sub ?? null,
          outcome,
          statusCode,
          resultSource,
        });
      }
      res.locals.beginSharedResourceMutation = () => {
        mutationStarted = true;
        return (statusCode) => recordResult(statusCode, 'FILE_OPERATION');
      };
      res.once('close', () => {
        if (!mutationStarted) {
          const statusCode = res.writableFinished ? res.statusCode : null;
          recordResult(statusCode, 'HTTP_RESPONSE');
        }
      });
      next();
    };
  }

  return {
    track,
    beginMutation: (res) => res.locals.beginSharedResourceMutation(),
    flush: () => pending,
  };
}
