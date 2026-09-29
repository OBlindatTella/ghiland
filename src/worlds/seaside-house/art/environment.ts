import { BackSide, Mesh, PMREMGenerator, Scene, SphereGeometry, WebGLRenderer } from 'three';
import { createSkyMaterial } from './shaders';

/** PMREM from the analytic sky. The dome is the visible sky; this map is lighting only. */
export function environmentFromSky(gl: WebGLRenderer, clouds: number): { dispose: () => void; texture: ReturnType<PMREMGenerator['fromScene']>['texture'] } {
  const pmrem = new PMREMGenerator(gl);
  const probe = new Scene();
  const material = createSkyMaterial(clouds);
  const sky = new Mesh(new SphereGeometry(20, 24, 16), material);
  sky.material.side = BackSide;
  probe.add(sky);
  const target = pmrem.fromScene(probe, 0.04, 0.1, 80);
  pmrem.dispose();
  return {
    texture: target.texture,
    dispose: () => {
      target.dispose();
      sky.geometry.dispose();
      material.dispose();
    },
  };
}
