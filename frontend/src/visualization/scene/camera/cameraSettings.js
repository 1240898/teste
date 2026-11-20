
/**
 * VIS07 - fixed camera values (usVIS07 2.4.1). One place for the numbers used
 * by the code, the tests and the documentation.
 */
export const FOV_DEGREES = 50;
export const NEAR = 0.05;
export const MIN_DISTANCE = 0.5;
export const MAX_DISTANCE_FACTOR = 1.5;
/** Extra room around the eight kitchen corners in the initial view (D11). */
export const FIT_MARGIN = 1.05;
export const MIN_POLAR_DEGREES = 5;
export const MAX_POLAR_DEGREES = 85;
export const INITIAL_POLAR_DEGREES = 55;
export const ROTATE_SPEED = 0.5;
export const PAN_SPEED = 0.8;
export const ZOOM_SPEED = 0.6;
export const DAMPING_FACTOR = 0.08;

/** Dispatched on the viewer canvas by the "Reset view" button (D10). */
export const RESET_VIEW_EVENT = 'kitchen-viewer:reset-view';

/**
 * Initial azimuth (OrbitControls: 0 deg = camera on +Z): the camera stands on
 * the side opposite the assembly-line wall, so the line faces the user (D11).
 */
export const WALL_AZIMUTH_DEGREES = Object.freeze({
  NORTH: 0,
  SOUTH: 180,
  EAST: -90,
  WEST: 90,
});

export const toRadians = (degrees) => (degrees * Math.PI) / 180;
