/** Shared per-frame wind, sun, fog, and exposure uniforms. Step 4. */
export interface EnvironmentUniforms {
  uTime: { value: number };
}

export function createEnvironmentUniforms(): EnvironmentUniforms {
  return { uTime: { value: 0 } };
}
