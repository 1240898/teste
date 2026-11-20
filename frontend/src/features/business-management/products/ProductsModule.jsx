import { useLayoutEffect, useMemo, useRef } from 'react';
import { Route, Routes } from 'react-router';
import { createProductApi } from './productApi.js';
import ProductsPage from './ProductsPage.jsx';
import ComponentConfigurationsModule from '../component-configurations/ComponentConfigurationsModule.jsx';
export default function ProductsModule({ request }) {
  const requestRef = useRef(request);
  useLayoutEffect(() => {
    requestRef.current = request;
  }, [request]);
  const api = useMemo(
    () => createProductApi((...args) => requestRef.current(...args)),
    [],
  );
  const boundRequest = (...args) => requestRef.current(...args);
  return (
    <Routes>
      <Route index element={<ProductsPage api={api} />} />
      <Route path="new" element={<ProductsPage api={api} />} />
      <Route path=":productId/edit" element={<ProductsPage api={api} />} />
      <Route
        path=":productId/component-configurations/*"
        element={<ComponentConfigurationsModule request={boundRequest} />}
      />
    </Routes>
  );
}
