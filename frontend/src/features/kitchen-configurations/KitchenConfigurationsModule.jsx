import { useLayoutEffect, useMemo, useRef } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { createKitchenConfigurationApi } from './kitchenConfigurationApi.js';
import { configurationPath } from './kitchenPaths.js';
import KitchenConfigurationDetailPage from './pages/KitchenConfigurationDetailPage.jsx';
import KitchenConfigurationEditorPage from './pages/KitchenConfigurationEditorPage.jsx';
import KitchenConfigurationListPage from './pages/KitchenConfigurationListPage.jsx';

function CreatePage({ api }) {
  const navigate = useNavigate();
  return (
    <KitchenConfigurationEditorPage
      api={api}
      mode="create"
      onSaved={(saved) =>
        navigate(configurationPath(saved.id), { state: { created: saved.id } })
      }
    />
  );
}

/**
 * WEB06 module, loaded lazily by ModulePage (WEB01) for the
 * "kitchenConfigurations" entry. Nested routes inherit [MANAGER] from the
 * WEB03 section: index -> list, "new" -> editor, ":configurationId" -> detail.
 * ONE api is built for the module; it always uses the latest session-bound
 * `request`, so a token renewal neither re-fetches nor remounts the pages
 * (the editor draft survives, BR 21).
 */
export default function KitchenConfigurationsModule({ request }) {
  const requestRef = useRef(request);
  useLayoutEffect(() => {
    requestRef.current = request;
  }, [request]);
  const api = useMemo(
    () =>
      createKitchenConfigurationApi((...args) => requestRef.current(...args)),
    [],
  );
  return (
    <Routes>
      <Route index element={<KitchenConfigurationListPage api={api} />} />
      <Route path="new" element={<CreatePage api={api} />} />
      <Route
        path=":configurationId"
        element={<KitchenConfigurationDetailPage api={api} />}
      />
    </Routes>
  );
}