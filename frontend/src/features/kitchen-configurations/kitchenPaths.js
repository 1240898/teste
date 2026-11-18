import { moduleRoutes } from '../../app/navigation/moduleRoutes.js';

const pathOf = (id) => moduleRoutes.find((route) => route.id === id).path;

/** Documented URLs (WEB01 moduleRoutes): the page and the VIS01 viewer. */
export const CONFIGURATIONS_PATH = pathOf('kitchenConfigurations');
export const VIEWER_PATH = pathOf('kitchenViewer');
export const configurationPath = (id) =>
  `${CONFIGURATIONS_PATH}/${encodeURIComponent(id)}`;