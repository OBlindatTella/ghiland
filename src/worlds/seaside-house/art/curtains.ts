import { Color, DoubleSide, MeshStandardMaterial, Vector2 } from 'three';
import { SEASIDE_SUN } from './horizon';
import { CURTAIN_VERTEX_SNIPPET } from './shaders';

export interface CurtainMaterial extends MeshStandardMaterial {
  userData: { time: { value: number } };
}

const SUN = new Color('#FFC98F');
const LIGHT = `vec3(${SEASIDE_SUN[0].toFixed(4)}, ${SEASIDE_SUN[1].toFixed(4)}, ${SEASIDE_SUN[2].toFixed(4)})`;

export function createCurtainMaterial(): CurtainMaterial {
  const time = { value: 0 };
  const material = new MeshStandardMaterial({
    color: '#F1EBE0',
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: 1,
    side: DoubleSide,
    depthWrite: false,
  }) as CurtainMaterial;
  material.userData.time = time;
  material.customProgramCacheKey = () => 'seaside-curtain-pleat';
  const header = 'uniform float uTime;\nuniform vec2 uCurtainSize;\nvarying vec2 vCurtainUv;\nvarying vec3 vCurtainWorld;\nvarying vec3 vCurtainWorldN;\n';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uCurtainSize = { value: new Vector2(0.8, 3.05) };
    shader.vertexShader = `${header}${shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${CURTAIN_VERTEX_SNIPPET}`)}`;
    shader.fragmentShader = `${header}${shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      vec3 ghN = normalize(vCurtainWorldN);
      vec3 ghV = normalize(cameraPosition - vCurtainWorld);
      vec3 ghL = ${LIGHT};
      float ghWrap = clamp((dot(ghN, ghL) + 0.5) / 1.5, 0.0, 1.0);
      float ghFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
      float ghAlpha = mix(0.62, 0.92, pow(1.0 - ghFacing, 2.0));
      float ghHem = 1.0 - smoothstep(0.0, 0.08 / uCurtainSize.y, vCurtainUv.y);
      ghAlpha = min(ghAlpha + ghHem * 0.12, 1.0);
      float ghTransmit = pow(max(dot(-ghV, ghL), 0.0), 4.0) * 0.9 * (1.0 - 0.5 * ghAlpha);
      gl_FragColor.rgb *= 0.55 + 0.45 * ghWrap;
      gl_FragColor.rgb += vec3(${SUN.r.toFixed(4)}, ${SUN.g.toFixed(4)}, ${SUN.b.toFixed(4)}) * ghTransmit;
      gl_FragColor.a = ghAlpha;
      `,
    )}`;
  };
  return material;
}
