// Names of scene objects that are not configuration elements. Element ids
// match ^[A-Za-z0-9_-]{1,64}$ (WEB06), so the ':' prefix can never clash.
export const LAYOUT_ROOT = 'layout:root';
export const LAYOUT_ROOM = 'layout:room';
export const LAYOUT_EQUIPMENT = 'layout:equipment';
export const LAYOUT_ASSEMBLY_LINE = 'layout:assembly-line';
export const ROOM_FLOOR = 'room:floor';

/** @param {'NORTH' | 'SOUTH' | 'EAST' | 'WEST'} wall */
export const roomWall = (wall) => `room:wall:${wall}`;

/**
 * Name of a node of an imported model inside the scene (usVIS02 BR 3): the
 * model's own node name gets the `part:` prefix, so `getObjectByName(id)`
 * always finds the element root and never a part such as `door-upper`.
 * @param {string} name node name in the GLB file
 */
export const modelPart = (name) => `part:${name}`;
export const LIGHTING_ROOT = 'lighting:root';
export const AMBIENT_LIGHT = 'lighting:ambient';
export const KEY_SPOTLIGHT = 'lighting:key';
