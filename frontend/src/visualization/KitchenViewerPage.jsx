import { defaultSceneModules } from './scene/defaultSceneModules.js';
import KitchenViewer from './viewer/KitchenViewer.jsx';

export default function KitchenViewerPage({ request }) {
  return <KitchenViewer request={request} modules={defaultSceneModules} />;
}