export const WORLD_MAP_PORTAL_IMAGE_WIDTH = 46;
export const WORLD_MAP_PORTAL_IMAGE_HEIGHT = 52;
export const WORLD_MAP_PORTAL_GLOW = Object.freeze({
  periodSec: 3.6,
  alphaMin: 0.30,
  alphaMax: 0.58,
  coreRadiusMinScale: 0.24,
  coreRadiusMaxScale: 0.33,
  burstRadiusMinScale: 0.51,
  burstRadiusMaxScale: 0.72,
  rayAlphaMin: 0.24,
  rayAlphaMax: 0.48,
  rayLengthMinScale: 0.92,
  rayLengthMaxScale: 1.06,
  rays: Object.freeze([
    Object.freeze({ angleDeg: 0, negativeLengthScale: 0.58, positiveLengthScale: 0.48, widthMin: 1.1, widthMax: 1.6, alphaScale: 0.88 }),
    Object.freeze({ angleDeg: -47, negativeLengthScale: 0.42, positiveLengthScale: 0.60, widthMin: 1.2, widthMax: 1.8, alphaScale: 0.72 }),
    Object.freeze({ angleDeg: 88, negativeLengthScale: 0.32, positiveLengthScale: 0.24, widthMin: 0.8, widthMax: 1.2, alphaScale: 0.44 }),
    Object.freeze({ angleDeg: -16, negativeLengthScale: 0.18, positiveLengthScale: 0.30, widthMin: 0.7, widthMax: 1.0, alphaScale: 0.36 }),
  ]),
  innerAlphaMin: 0.32,
  innerAlphaMax: 0.52,
  innerRadiusMinScale: 0.12,
  innerRadiusMaxScale: 0.17,
});
export const WORLD_MAP_PORTAL_SHADOW = Object.freeze({
  color: 'rgba(4, 20, 36, 0.44)',
  blur: 8,
  offsetY: 3,
  floorColor: 'rgba(8, 22, 34, 0.30)',
  floorBlur: 2.4,
  floorOffsetY: 13,
  floorWidth: 36,
  floorHeight: 12,
});

export const WORLD_MAP_PORTAL_INSTANCES = Object.freeze([
  Object.freeze({ id: 'western-lightburst-portal', coordinate: 'C11', visible: true }),
  Object.freeze({ id: 'northeast-lightburst-portal', coordinate: 'K05', visible: true }),
]);
