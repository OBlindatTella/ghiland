import { BackSide, Color, ShaderMaterial, Vector3, Vector4 } from 'three';
import { FOAM_ROCKS } from './rocks';
import { WAVES } from './waves';

const SKY_FN = /* glsl */ `
float skyHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float skyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = skyHash(i);
  float b = skyHash(i + vec2(1.0, 0.0));
  float c = skyHash(i + vec2(0.0, 1.0));
  float d = skyHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 seasideSky(vec3 dir, vec3 sun, float clouds, float time) {
  vec3 n = normalize(dir);
  float elev = clamp(n.y, 0.0, 1.0);
  vec3 zenith = vec3(0.157, 0.275, 0.428);
  vec3 horizon = vec3(0.799, 0.571, 0.372);
  vec3 below = vec3(0.15, 0.12, 0.10);
  vec3 col = mix(horizon, zenith, pow(elev, 0.4));
  col = mix(col, horizon, smoothstep(0.18, 0.0, elev) * 0.4);
  col = mix(col, mix(horizon, below, clamp(-n.y * 1.6, 0.0, 1.0)), step(0.0, -n.y));
  float sunDot = max(dot(n, normalize(sun)), 0.0);
  vec3 sunCol = vec3(1.0, 0.592, 0.281);
  col += sunCol * pow(sunDot, 6.0) * 0.85;
  col += sunCol * pow(sunDot, 96.0) * 2.2;
  col += vec3(1.0, 0.9, 0.62) * smoothstep(0.9986, 0.99955, sunDot) * 8.0;
  vec2 uv = n.xz / max(n.y + 0.22, 0.12);
  float field = 0.0;
  field += step(0.5, clouds) * smoothstep(0.58, 0.8, skyNoise(uv * 0.12 + vec2(time * 0.004, 0.2)));
  field += step(1.5, clouds) * smoothstep(0.62, 0.82, skyNoise(uv * 0.22 + vec2(time * 0.006, 2.0))) * 0.65;
  field += step(2.5, clouds) * smoothstep(0.68, 0.86, skyNoise(uv * 0.4 + vec2(1.3, time * 0.007))) * 0.4;
  float away = 1.0 - smoothstep(0.82, 0.995, sunDot);
  col = mix(col, vec3(0.96, 0.78, 0.62), clamp(field, 0.0, 1.0) * 0.38 * away * smoothstep(0.02, 0.18, n.y));
  return col;
}
`;

function linear(hex: string): Vector3 {
  const color = new Color(hex);
  color.convertSRGBToLinear();
  return new Vector3(color.r, color.g, color.b);
}

export function createSkyMaterial(clouds: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uSun: { value: new Vector3(-0.367, 0.208, 0.907) },
      uClouds: { value: clouds },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = position;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform float uClouds;
      uniform float uTime;
      varying vec3 vDir;
      ${SKY_FN}
      void main() {
        gl_FragColor = vec4(seasideSky(vDir, uSun, uClouds, uTime), 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}

export function createOceanMaterial(waveCount: number, vertexCount = waveCount): ShaderMaterial {
  const waves = WAVES.map((wave) => new Vector4(wave.dirX, wave.dirZ, wave.length, wave.amplitude));
  const extra = WAVES.map((wave) => new Vector4(wave.steepness, wave.speed, 0, 0));
  const foam = FOAM_ROCKS.map((rock) => new Vector4(rock[0], rock[1], rock[2], rock[3]));
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCount: { value: waveCount },
      uVertexCount: { value: Math.min(vertexCount, waveCount) },
      uSun: { value: new Vector3(-0.367, 0.208, 0.907) },
      uWave: { value: waves },
      uExtra: { value: extra },
      uFoam: { value: foam },
      uDeep: { value: linear('#176878') },
      uShallow: { value: linear('#3EAEA6') },
      uFog: { value: linear('#E7C7A4') },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uVertexCount;
      uniform vec4 uWave[5];
      uniform vec4 uExtra[5];
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 normal = vec3(0.0, 1.0, 0.0);
        float height = 0.0;
        for (int i = 0; i < 5; i++) {
          float use = step(float(i) + 0.5, uVertexCount);
          vec2 dir = uWave[i].xy;
          float len = max(length(dir), 0.0001);
          dir /= len;
          float L = uWave[i].z;
          float A = uWave[i].w;
          float steep = uExtra[i].x;
          float speed = uExtra[i].y;
          float k = 6.2831853 / L;
          float phase = k * (dir.x * world.x + dir.y * world.z) + uTime * speed;
          float s = sin(phase);
          float c = cos(phase);
          world.x += steep * A * dir.x * c * use;
          world.z += steep * A * dir.y * c * use;
          world.y += A * s * use;
          height += A * s * use;
          normal.x -= dir.x * k * A * c * use;
          normal.z -= dir.y * k * A * c * use;
        }
        vWorld = world;
        vHeight = height;
        vNormal = normalize(normal);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uCount;
      uniform float uVertexCount;
      uniform vec4 uWave[5];
      uniform vec4 uExtra[5];
      uniform vec3 uSun;
      uniform vec4 uFoam[4];
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFog;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      ${SKY_FN}
      void main() {
        vec3 N = normalize(vNormal);
        for (int i = 0; i < 5; i++) {
          float use = step(uVertexCount, float(i) + 0.5) * step(float(i) + 0.5, uCount);
          vec2 dir = uWave[i].xy;
          float len = max(length(dir), 0.0001);
          dir /= len;
          float L = uWave[i].z;
          float A = uWave[i].w;
          float speed = uExtra[i].y;
          float k = 6.2831853 / L;
          float phase = k * (dir.x * vWorld.x + dir.y * vWorld.z) + uTime * speed;
          float c = cos(phase);
          N.x -= dir.x * k * A * c * use;
          N.z -= dir.y * k * A * c * use;
        }
        N = normalize(N);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, N);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 water = mix(uDeep, uShallow, clamp(0.35 + vHeight * 1.4, 0.0, 1.0));
        vec3 sky = seasideSky(R, uSun, 2.0, uTime);
        vec3 col = mix(water, sky, clamp(fres * 0.65, 0.0, 0.72));
        vec3 H = normalize(normalize(uSun) + V);
        float spark = fract(sin(dot(floor(vWorld.xz * 3.5), vec2(127.1, 311.7))) * 43758.5);
        float glitter = pow(max(dot(N, H), 0.0), 220.0) * smoothstep(0.45, 0.92, spark);
        col += vec3(1.0, 0.78, 0.48) * glitter * 2.4;
        float foam = 0.0;
        for (int i = 0; i < 4; i++) {
          float dist = distance(vWorld.xz, uFoam[i].xy);
          float band = smoothstep(uFoam[i].z, uFoam[i].z * 0.35, dist);
          float pulse = 0.45 + 0.55 * sin(uTime * 1.25 + uFoam[i].w);
          foam = max(foam, band * pulse);
        }
        float shore = smoothstep(20.0, 11.2, vWorld.z) * smoothstep(-0.02, 0.16, vHeight);
        foam = max(foam, shore);
        col = mix(col, vec3(0.82, 0.86, 0.84), clamp(foam, 0.0, 1.0) * 0.62);
        float distCam = distance(cameraPosition, vWorld);
        float haze = 1.0 - exp(-0.000121 * distCam * distCam);
        col = mix(col, uFog, clamp(haze, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    fog: false,
    toneMapped: false,
  });
}

export const CURTAIN_VERTEX_SNIPPET = /* glsl */ `
float hem = 1.0 - uv.y;
float gust = 0.20 + 0.15 * sin(uTime * 0.65 + uv.x * 5.0);
float rawBillow = hem * hem * gust;
float billow = min(0.35, rawBillow);
transformed.z -= billow;
float flutter = clamp(sin(uTime * 1.6 + uv.y * 8.0) * hem * 0.018, -0.02, 0.02);
transformed.x += flutter;
float open = rawBillow < 0.35 ? 1.0 : 0.0;
float dGustDu = 0.15 * cos(uTime * 0.65 + uv.x * 5.0) * 5.0;
float dhDu = -hem * hem * dGustDu * open;
float dhDv = 2.0 * hem * gust * open;
objectNormal = normalize(vec3(-dhDu / uCurtainSize.x, -dhDv / uCurtainSize.y, 1.0));
transformedNormal = normalMatrix * objectNormal;
vNormal = normalize(transformedNormal);
`;
