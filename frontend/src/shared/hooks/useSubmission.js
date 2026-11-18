import { useCallback, useRef, useState } from 'react';

function isUnknownOutcome(error) {
  return ['network', 'timeout', 'aborted', 'invalid-response'].includes(
    error?.kind,
  );
}

export function useSubmission() {
  const active = useRef(false);
  const [phase, setPhase] = useState('idle');

  const submit = useCallback(async (operation, { isSuccessful } = {}) => {
    if (active.current) return { phase: 'ignored' };

    active.current = true;
    setPhase('submitting');
    try {
      const result = await operation();
      const succeeded = isSuccessful ? isSuccessful(result) : true;
      const nextPhase = succeeded ? 'succeeded' : 'failed';
      setPhase(nextPhase);
      return { phase: nextPhase, result };
    } catch (error) {
      const nextPhase = isUnknownOutcome(error) ? 'outcome_unknown' : 'failed';
      setPhase(nextPhase);
      return { phase: nextPhase, error };
    } finally {
      active.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    if (!active.current) setPhase('idle');
  }, []);

  return {
    phase,
    isSubmitting: phase === 'submitting',
    submit,
    reset,
  };
}
