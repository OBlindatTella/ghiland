import { Color, Vector3 } from 'three';

/** Same mapping as sun.ts. Duplicated so this folder does not import its parent. */
function sunDirection(elevationDeg: number, azimuthDeg: number): [number, number, number] {
  const elevation = (elevationDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const horizontal = Math.cos(elevation);
  return [Math.sin(azimuth) * horizontal, Math.sin(elevation), Math.cos(azimuth) * horizontal];
}

/** D-040. Elevation 12.5° so the 0.27° disk sits behind the lintel at V2. */
export const SEASIDE_SUN_ELEVATION = 12.5;
export const SEASIDE_SUN_AZIMUTH = -22;
export const SEASIDE_SUN = sunDirection(SEASIDE_SUN_ELEVATION, SEASIDE_SUN_AZIMUTH);

/** FogExp2. 21% at 1 km, 84% at 2.8 km. Interior and cove stay clear. */
export const SEASIDE_FOG_COLOR = '#D6D4CC';
export const SEASIDE_FOG_DENSITY = 0.00048;
export const SEASIDE_BACKGROUND = '#D6D4CC';

export const SKY_DOME_RADIUS = 4500;
export const CAMERA_FAR = 5000;

/** One sky/horizon pair, included by the dome, the ocean and the ocean haze. */
export const HORIZON_GLSL = /* glsl */ `
vec3 ghSrgb(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}
float ghHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float ghNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = ghHash(i);
  float b = ghHash(i + vec2(1.0, 0.0));
  float c = ghHash(i + vec2(0.0, 1.0));
  float d = ghHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float ghSunSide(vec3 dir, vec3 sun) {
  vec2 d = dir.xz;
  vec2 s = sun.xz;
  float dl = length(d);
  float sl = length(s);
  if (dl < 1e-4 || sl < 1e-4) return 0.0;
  return pow(max(dot(d / dl, s / sl), 0.0), 6.0);
}
vec3 ghStops(float e, vec3 c0, vec3 c2, vec3 c8, vec3 c20, vec3 c45, vec3 c90) {
  float t2 = clamp(e / 2.0, 0.0, 1.0);
  float t8 = clamp((e - 2.0) / 6.0, 0.0, 1.0);
  float t20 = clamp((e - 8.0) / 12.0, 0.0, 1.0);
  float t45 = clamp((e - 20.0) / 25.0, 0.0, 1.0);
  float t90 = clamp((e - 45.0) / 45.0, 0.0, 1.0);
  vec3 c = mix(c0, c2, t2);
  c = mix(c, c8, t8);
  c = mix(c, c20, t20);
  c = mix(c, c45, t45);
  c = mix(c, c90, t90);
  return c;
}
vec3 ghHorizon(vec3 dir, vec3 sun) {
  float s = ghSunSide(dir, sun);
  vec3 away = ghSrgb(vec3(214.0, 212.0, 204.0) / 255.0);
  vec3 toward = ghSrgb(vec3(241.0, 215.0, 176.0) / 255.0);
  return mix(away, toward, s);
}
vec3 ghSky(vec3 dir, vec3 sun, float clouds, float time) {
  vec3 n = normalize(dir);
  vec3 sunN = normalize(sun);
  float s = ghSunSide(n, sunN);
  vec3 col;
  if (n.y <= 0.0) {
    col = ghSrgb(vec3(43.0, 58.0, 64.0) / 255.0);
  } else {
    float elev = degrees(asin(clamp(n.y, 0.0, 1.0)));
    vec3 away = ghStops(elev,
      ghSrgb(vec3(214.0, 212.0, 204.0) / 255.0),
      ghSrgb(vec3(203.0, 208.0, 207.0) / 255.0),
      ghSrgb(vec3(179.0, 194.0, 203.0) / 255.0),
      ghSrgb(vec3(147.0, 174.0, 194.0) / 255.0),
      ghSrgb(vec3(116.0, 150.0, 180.0) / 255.0),
      ghSrgb(vec3(94.0, 134.0, 170.0) / 255.0));
    vec3 toward = ghStops(elev,
      ghSrgb(vec3(241.0, 215.0, 176.0) / 255.0),
      ghSrgb(vec3(237.0, 211.0, 174.0) / 255.0),
      ghSrgb(vec3(220.0, 207.0, 184.0) / 255.0),
      ghSrgb(vec3(185.0, 191.0, 192.0) / 255.0),
      ghSrgb(vec3(138.0, 163.0, 184.0) / 255.0),
      ghSrgb(vec3(94.0, 134.0, 170.0) / 255.0));
    col = mix(away, toward, s);
  }
  float sunDot = max(dot(n, sunN), 0.0);
  col += ghSrgb(vec3(255.0, 225.0, 176.0) / 255.0) * pow(sunDot, 8.0) * 0.55;
  col += ghSrgb(vec3(255.0, 233.0, 200.0) / 255.0) * pow(sunDot, 180.0) * 1.2;
  col += ghSrgb(vec3(255.0, 246.0, 230.0) / 255.0) * smoothstep(0.999986, 0.999991, sunDot) * 24.0;
  float elevDeg = degrees(asin(clamp(n.y, -1.0, 1.0)));
  vec2 uv = n.xz / max(n.y + 0.08, 0.05);
  float bandA = smoothstep(1.2, 2.4, elevDeg) * (1.0 - smoothstep(8.5, 11.0, elevDeg));
  float streak = smoothstep(0.42, 0.72, ghNoise(vec2(uv.x * 1.8, uv.y * 0.18) + vec2(time * 0.002, 0.4)));
  float cirrus = smoothstep(0.62, 0.84, ghNoise(uv * 0.42 + vec2(time * 0.003, 1.2))) * streak;
  float layerA = bandA * cirrus * step(0.5, clouds);
  float bandB = smoothstep(14.0, 16.0, elevDeg) * (1.0 - smoothstep(36.0, 42.0, elevDeg));
  float puff = smoothstep(0.68, 0.88, ghNoise(uv * 0.16 + vec2(2.0, time * 0.0015)));
  float layerB = bandB * puff * step(1.5, clouds);
  float sunClear = 1.0 - smoothstep(cos(radians(8.0)), cos(radians(6.0)), sunDot);
  float cover = clamp(layerA * 0.85 + layerB * 0.7, 0.0, 1.0) * sunClear;
  vec3 cloudA = mix(ghSrgb(vec3(217.0, 214.0, 208.0) / 255.0), ghSrgb(vec3(244.0, 234.0, 223.0) / 255.0), s);
  vec3 cloudB = ghSrgb(vec3(238.0, 233.0, 226.0) / 255.0);
  vec3 cloudCol = mix(cloudA, cloudB, clamp(layerB / max(layerA + layerB, 0.001), 0.0, 1.0));
  col = mix(col, cloudCol, cover);
  return col;
}
vec3 ghFogCol(vec3 dir, vec3 sun) {
  return ghHorizon(dir, sun);
}
`;

export function linearColor(hex: string): Vector3 {
  const color = new Color(hex);
  color.convertSRGBToLinear();
  return new Vector3(color.r, color.g, color.b);
}

export function sunVector(): Vector3 {
  return new Vector3(SEASIDE_SUN[0], SEASIDE_SUN[1], SEASIDE_SUN[2]);
}
