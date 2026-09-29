import { DoubleSide, MeshStandardMaterial, Vector2 } from 'three';
import { CURTAIN_VERTEX_SNIPPET } from './shaders';

export interface CurtainMaterial extends MeshStandardMaterial {
  userData: { time: { value: number } };
}

export function createCurtainMaterial(): CurtainMaterial {
  const time = { value: 0 };
  const material = new MeshStandardMaterial({
    color: '#E7D7C4',
    roughness: 0.94,
    metalness: 0,
    transparent: true,
    opacity: 0.78,
    side: DoubleSide,
    depthWrite: false,
  }) as CurtainMaterial;
  material.userData.time = time;
  material.customProgramCacheKey = () => 'seaside-curtain-billow';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uCurtainSize = { value: new Vector2(0.8, 3.1) };
    shader.vertexShader = `uniform float uTime;\nuniform vec2 uCurtainSize;\n${shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${CURTAIN_VERTEX_SNIPPET}`)}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      float backlit = pow(clamp(dot(normalize(normal), vec3(-0.367, 0.208, 0.907)), 0.0, 1.0), 1.2);
      gl_FragColor.rgb += vec3(1.0, 0.72, 0.42) * backlit * 0.22;
      `,
    );
  };
  return material;
}
