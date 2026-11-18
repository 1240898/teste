import { AssemblyLineFrame } from '../../../src/modules/kitchen-configuration-management/domain/services/AssemblyLineFrame.js';

const dimensions = { width: 12, depth: 8 };
const position = { x: 2, y: 0.9, z: -3 };
const belt = { x: 1, y: 0.1, z: 0.6 };
const placement = (rotationY, at = { x: 0, y: 0.9, z: 0 }) => ({
  position: at,
  rotation: { x: 0, y: rotationY, z: 0 },
  scale: { x: 7, y: 1, z: 1 },
});

describe('WEB06 AssemblyLineFrame (UT18)', () => {
  test.each([
    ['NORTH', 2, 1],
    ['SOUTH', -2, 7],
    ['EAST', -3, 4],
    ['WEST', 3, 8],
  ])('%s wall: u and d of 2.4.2', (wall, u, d) => {
    const frame = AssemblyLineFrame.of(wall, dimensions);
    expect(frame.u(position)).toBeCloseTo(u);
    expect(frame.d(position)).toBeCloseTo(d);
  });

  test.each([
    ['NORTH', 0, true],
    ['NORTH', 180, true],
    ['NORTH', 90, false],
    ['NORTH', 270, false],
    ['SOUTH', 0, true],
    ['SOUTH', 90, false],
    ['EAST', 90, true],
    ['EAST', 270, true],
    ['EAST', 0, false],
    ['EAST', 180, false],
    ['WEST', -90, true],
    ['WEST', 0, false],
  ])(
    '%s wall, rotation.y %s -> along the wall: %s',
    (wall, rotation, along) => {
      expect(AssemblyLineFrame.of(wall, dimensions).isAlongWall(rotation)).toBe(
        along,
      );
    },
  );

  test('spans of a 1.0 x 0.1 x 0.6 m belt scaled x7 (2.4.3)', () => {
    const north = AssemblyLineFrame.of('NORTH', dimensions);
    expect(north.span(placement(0), belt)).toEqual({
      uMin: -3.5,
      uMax: 3.5,
      dMin: 3.7,
      dMax: 4.3,
      bottom: 0.9,
      top: 1,
    });
    const across = north.span(placement(90), belt);
    expect(across.uMax - across.uMin).toBeCloseTo(0.6);
    expect(across.dMax - across.dMin).toBeCloseTo(7);
    const east = AssemblyLineFrame.of('EAST', dimensions).span(
      placement(270),
      belt,
    );
    expect(east.uMax - east.uMin).toBeCloseTo(7);
    expect(east.dMax - east.dMin).toBeCloseTo(0.6);
  });

  test('tolerances defined at the WEB06 <-> VIS checkpoint', () => {
    expect(AssemblyLineFrame.GAP_TOLERANCE).toBe(0.05);
    expect(AssemblyLineFrame.LEVEL_TOLERANCE).toBe(0.15);
    expect(() => AssemblyLineFrame.of('UP', dimensions)).toThrow(TypeError);
  });
});