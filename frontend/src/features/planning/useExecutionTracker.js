import { useCallback, useEffect, useRef, useState } from 'react';
import { uncertain } from './planningApi.js';

export function useExecutionTracker(api) {
  const [state, setState] = useState(null);
  const active = useRef(null);
  const timer = useRef(null);
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    active.current?.abort();
    active.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const track = useCallback(
    async (id, original, post = false) => {
      if (active.current) return;
      const controller = new AbortController();
      active.current = controller;
      const current = () =>
        active.current === controller && !controller.signal.aborted;
      const busy = { executionId: id, request: original, busy: true };
      setState(busy);
      function finish(next) {
        if (current()) {
          active.current = null;
          setState(next);
        }
      }
      function failure(error, lookup) {
        const retryable =
          lookup &&
          error.status === 404 &&
          error.code === 'EXECUTION_NOT_FOUND' &&
          Boolean(original);
        finish({
          ...busy,
          busy: false,
          error,
          retryable,
          lookup: lookup && uncertain(error),
        });
      }
      function accept(response) {
        if (!current()) return;
        if (
          response?.executionId !== id ||
          typeof response.retryable !== 'boolean' ||
          (response.status === 'COMPLETED' && !response.result?.data) ||
          !['RUNNING', 'FAILED', 'COMPLETED'].includes(response.status)
        ) {
          failure({ code: 'planInvalidState' }, false);
          return;
        }
        const next = { ...response, request: response.request ?? original };
        if (next.status === 'RUNNING' && next.retryable === false) {
          setState({ ...next, busy: true });
          timer.current = setTimeout(read, 1000);
        } else finish(next);
      }
      async function read() {
        try {
          accept(await api.result(id, controller.signal));
        } catch (error) {
          failure(error, true);
        }
      }
      if (!post) return read();
      try {
        accept(await api.start(original, controller.signal));
      } catch (error) {
        if (uncertain(error) && current()) await read();
        else failure(error, false);
      }
    },
    [api],
  );
  return { state, track };
}
