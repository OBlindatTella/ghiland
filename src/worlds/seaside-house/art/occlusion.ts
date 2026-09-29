import { Color, type MeshStandardMaterial } from 'three';

/** Indirect light falls off toward the corridor. Terrace and exterior stay at 1. */
export const ROOM_OCCLUSION_SNIPPET = /* glsl */ `
float ghK = 1.0;
if (vGhWorld.z < -3.5) {
  ghK = mix(0.22, 0.45, smoothstep(-9.0, -3.5, vGhWorld.z));
} else if (vGhWorld.z < 4.5) {
  ghK = mix(0.50, 1.00, smoothstep(-3.5, 4.5, vGhWorld.z));
}
reflectedLight.indirectDiffuse *= ghK;
reflectedLight.indirectSpecular *= ghK;
`;

const SLAT = new Color('#C9A67E');
const GAP = new Color('#2A211A');

function boardSeam(axis: 'x' | 'z'): string {
  const coord = axis === 'x' ? 'vGhWorld.x' : 'vGhWorld.z';
  return /* glsl */ `
float ghBoard = fract(${coord} * 5.0);
float ghSeam = smoothstep(0.0, 0.12, ghBoard) * smoothstep(0.0, 0.12, 1.0 - ghBoard);
diffuseColor.rgb *= mix(0.78, 1.0, ghSeam);
`;
}

const SLAT_SNIPPET = /* glsl */ `
float ghStripe = mod(vGhWorld.x + 6.0, 0.06);
float ghGap = step(0.04, ghStripe);
diffuseColor.rgb = mix(vec3(${SLAT.r.toFixed(4)}, ${SLAT.g.toFixed(4)}, ${SLAT.b.toFixed(4)}), vec3(${GAP.r.toFixed(4)}, ${GAP.g.toFixed(4)}, ${GAP.b.toFixed(4)}), ghGap);
`;

export type InteriorShade = 'plain' | 'slats' | 'oak-boards' | 'deck-boards';

/** One shared chunk: world position, then k on indirect light. Optional floor or ceiling stripes. */
export function applyInteriorShade(material: MeshStandardMaterial, mode: InteriorShade = 'plain'): void {
  material.customProgramCacheKey = () => `gh-interior-${mode}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGhWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGhWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    let color = '';
    if (mode === 'slats') color = SLAT_SNIPPET;
    if (mode === 'oak-boards') color = boardSeam('x');
    if (mode === 'deck-boards') color = boardSeam('z');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGhWorld;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n${color}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${ROOM_OCCLUSION_SNIPPET}`);
  };
}
