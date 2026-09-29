import { Color, type MeshStandardMaterial, MeshStandardMaterial as Standard } from 'three';

const TINT = new Color('#9FB3B0');

/** Face-on glass stays faint. The edge picks up the sky. */
export function createFresnelGlass(fog: boolean): MeshStandardMaterial {
  const material = new Standard({
    color: '#ffffff',
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    envMapIntensity: 1.15,
    fog,
  });
  material.customProgramCacheKey = () => `seaside-fresnel-glass-${fog ? 'fog' : 'clear'}`;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      float ghNdotV = abs(dot(normalize(normal), normalize(vViewPosition)));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(${TINT.r.toFixed(4)}, ${TINT.g.toFixed(4)}, ${TINT.b.toFixed(4)}), 0.3);
      gl_FragColor.a = mix(0.04, 0.35, pow(1.0 - ghNdotV, 4.0));
      `,
    );
  };
  return material;
}
