
import { useCallback, useEffect, useRef, useState } from 'react';
import { pendingOutcomes } from './pendingOutcomes.js';

function isUnknownOutcome(error) {
  return ['network', 'timeout', 'aborted', 'invalid-response'].includes(
    error?.kind,
  );
}

/**
 * Tracks one submission at a time.
 * - Default: an unknown outcome (timeout, network...) is reported, but the
 *   operation may be retried (safe for validation, reload, reads).
 * - blockOnUnknownOutcome: after an unknown outcome, further submissions are
 *   blocked until reset() (non-repeatable operations).
 * - persistKey: same as blockOnUnknownOutcome, and the block survives leaving
 *   and returning to the page (sessionStorage), as required by BR25.
 */
export function useSubmission({ blockOnUnknownOutcome = false, persistKey } = {}) {
  const blocks = blockOnUnknownOutcome || Boolean(persistKey);
  const active = useRef(false);
  const outcomeUnknown = useRef(blocks && pendingOutcomes.has(persistKey));
  const [phase, setPhase] = useState(() =>
    outcomeUnknown.current ? 'outcome_unknown' : 'idle',
  );

  // A different record (another persistKey) has its own pending state.
  useEffect(() => {
    const pending = blocks && pendingOutcomes.has(persistKey);
    outcomeUnknown.current = pending;
    setPhase((current) =>
      pending ? 'outcome_unknown' : current === 'outcome_unknown' ? 'idle' : current,
    );
  }, [blocks, persistKey]);

  const markUnknown = useCallback(() => {
    if (!blocks) return;
    outcomeUnknown.current = true;
    pendingOutcomes.add(persistKey);
  }, [blocks, persistKey]);

  const submit = useCallback(
    async (operation, { isSuccessful, isOutcomeUnknown } = {}) => {
      if (blocks && outcomeUnknown.current) return { phase: 'outcome_unknown' };
      if (active.current) return { phase: 'ignored' };

      active.current = true;
      setPhase('submitting');
      try {
        const result = await operation();
        if (result?.phase === 'outcome_unknown') {
          markUnknown();
          setPhase('outcome_unknown');
          return { phase: 'outcome_unknown', result };
        }
        const succeeded = isSuccessful ? isSuccessful(result) : true;
        const nextPhase = succeeded ? 'succeeded' : 'failed';
        setPhase(nextPhase);
        return { phase: nextPhase, result };
      } catch (error) {
        const unknown =
          isUnknownOutcome(error) || Boolean(isOutcomeUnknown?.(error));
        if (unknown) markUnknown();
        const nextPhase = unknown ? 'outcome_unknown' : 'failed';
        setPhase(nextPhase);
        return { phase: nextPhase, error };
      } finally {
        active.current = false;
      }
    },
    [blocks, markUnknown],
  );

  /** Call only after the user confirmed the real result (e.g. reloaded stock). */
  const reset = useCallback(() => {
    if (active.current) return;
    outcomeUnknown.current = false;
    pendingOutcomes.remove(persistKey);
    setPhase('idle');
  }, [persistKey]);

  return {
    phase,
    isSubmitting: phase === 'submitting',
    isBlocked: blocks && phase === 'outcome_unknown',
    submit,
    reset,
  };
}
