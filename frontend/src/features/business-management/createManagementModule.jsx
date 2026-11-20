import { createElement, useLayoutEffect, useMemo, useRef } from 'react';

/** Keeps WEB01's injected ModuleRequest current without importing apiClient. */
export function createManagementModule(createApi, Page) {
  return function ManagementModule({ request }) {
    const requestRef = useRef(request);
    useLayoutEffect(() => {
      requestRef.current = request;
    }, [request]);
    const api = useMemo(
      () => createApi((...args) => requestRef.current(...args)),
      [],
    );
    return createElement(Page, { api });
  };
}