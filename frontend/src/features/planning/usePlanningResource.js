import { useCallback, useEffect, useRef, useState } from 'react';

export function usePlanningResource(read) {
  const revision = useRef(0);
  const [state, setState] = useState({ loading: true });
  const reload = useCallback(async () => {
    const current = Symbol();
    revision.current = current;
    setState({ loading: true });
    try {
      const data = await read();
      if (revision.current === current) setState({ data });
    } catch (error) {
      if (revision.current === current) setState({ error });
    }
  }, [read]);
  useEffect(() => {
    reload();
    return () => {
      revision.current = Symbol();
    };
  }, [reload]);
  return { ...state, reload };
}
