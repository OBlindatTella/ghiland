import { BackSide, DataTexture, RepeatWrapping, RGBAFormat, ShaderMaterial, Vector4 } from 'three';
import { HORIZON_GLSL, sunVector } from './horizon';
import { FOAM_ROCKS } from './rocks';
import { WAVES } from './waves';

function flatNormal(): DataTexture {
  const texture = new DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  texture.userData.flat = true;
  return texture;
}

export function createSkyMaterial(clouds: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uSun: { value: sunVector() },
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
      ${HORIZON_GLSL}
      void main() {
        gl_FragColor = vec4(ghSky(vDir, uSun, uClouds, uTime), 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true,
  });
}

export function createOceanMaterial(waveCount: number): ShaderMaterial {
  const waves = WAVES.map((wave) => new Vector4(wave.dirX, wave.dirZ, wave.length, wave.amplitude));
  const extra = WAVES.map((wave) => new Vector4(wave.steepness, wave.speed, 0, 0));
  const foam = FOAM_ROCKS.map((rock) => new Vector4(rock[0], rock[1], rock[2], rock[3]));
  const normalA = flatNormal();
  const normalB = flatNormal();
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCount: { value: waveCount },
      uSun: { value: sunVector() },
      uWave: { value: waves },
      uExtra: { value: extra },
      uFoam: { value: foam },
      uClouds: { value: 2 },
      uNormalA: { value: normalA },
      uNormalB: { value: normalB },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uCount;
      uniform vec4 uWave[5];
      uniform vec4 uExtra[5];
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        float radius = length(position.xz);
        float fade = smoothstep(900.0, 250.0, radius);
        vec3 normal = vec3(0.0, 1.0, 0.0);
        float height = 0.0;
        for (int i = 0; i < 5; i++) {
          float use = step(float(i) + 0.5, uCount);
          vec2 dir = uWave[i].xy;
          float len = max(length(dir), 0.0001);
          dir /= len;
          float L = uWave[i].z;
          float A = uWave[i].w * fade;
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
      uniform vec3 uSun;
      uniform float uClouds;
      uniform vec4 uFoam[6];
      uniform sampler2D uNormalA;
      uniform sampler2D uNormalB;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      ${HORIZON_GLSL}
      vec3 ghWater(float r) {
        vec3 c20 = ghSrgb(vec3(27.0, 74.0, 82.0) / 255.0);
        vec3 c60 = ghSrgb(vec3(31.0, 74.0, 90.0) / 255.0);
        vec3 c200 = ghSrgb(vec3(36.0, 72.0, 94.0) / 255.0);
        vec3 c600 = ghSrgb(vec3(38.0, 69.0, 92.0) / 255.0);
        vec3 col = mix(c20, c60, smoothstep(20.0, 60.0, r));
        col = mix(col, c200, smoothstep(60.0, 200.0, r));
        col = mix(col, c600, smoothstep(200.0, 600.0, r));
        return col;
      }
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        vec2 xz = vWorld.xz;
        float distCam = distance(cameraPosition, vWorld);
        float horizontal = length(vWorld.xz - cameraPosition.xz);
        vec3 n1 = texture2D(uNormalA, xz / 7.0 + vec2(uTime * 0.035, uTime * 0.012)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormalB, xz / 23.0 + vec2(-uTime * 0.012, uTime * 0.02)).xyz * 2.0 - 1.0;
        float detail = mix(1.0, 0.15, smoothstep(50.0, 1500.0, horizontal));
        N = normalize(N + vec3(n1.x + n2.x, 0.0, n1.y + n2.y) * 0.35 * detail);
        float ndv = max(dot(N, V), 0.0);
        float fres = clamp(0.02 + 0.98 * pow(1.0 - ndv, 5.0), 0.0, 0.9);
        vec3 sunN = normalize(uSun);
        vec3 sunXZ = normalize(vec3(sunN.x, 0.0, sunN.z));
        vec3 viewXZ = normalize(vec3(-V.x, 0.0, -V.z));
        vec3 water = ghWater(horizontal);
        water += ghSrgb(vec3(47.0, 124.0, 121.0) / 255.0) * max(vHeight, 0.0) * 1.2 * pow(max(dot(viewXZ, sunXZ), 0.0), 2.0);
        vec3 R = reflect(-V, N);
        vec3 sky = ghSky(R, uSun, uClouds, uTime);
        vec3 col = mix(water, sky, fres);
        vec3 H = normalize(sunN + V);
        float glitter = pow(max(dot(N, H), 0.0), 900.0) * 30.0;
        col += ghSrgb(vec3(255.0, 230.0, 184.0) / 255.0) * glitter;
        float foam = 0.0;
        for (int i = 0; i < 6; i++) {
          float dist = distance(vWorld.xz, uFoam[i].xy);
          float band = smoothstep(uFoam[i].z, uFoam[i].z * 0.35, dist);
          float pulse = 0.45 + 0.55 * sin(uTime * 1.25 + uFoam[i].w);
          foam = max(foam, band * pulse);
        }
        col = mix(col, ghSrgb(vec3(217.0, 221.0, 216.0) / 255.0), clamp(foam, 0.0, 1.0) * 0.55);
        vec3 viewDir = normalize(vWorld - cameraPosition);
        float haze = 1.0 - exp(-pow(0.00048 * distCam, 2.0));
        col = mix(col, ghFogCol(viewDir, uSun), clamp(haze, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    fog: false,
    toneMapped: true,
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
