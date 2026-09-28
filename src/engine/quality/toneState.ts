import { ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { NoToneMapping } from 'three';

/** AgX runs as a composer effect. three does not tone-map a render target. */
export const COMPOSER_TONE_MODE = ToneMappingMode.AGX;

export interface ComposerToneState {
  rendererToneMapping: number;
  agx: boolean;
  multisampling: number;
  passes: string[];
}

/**
 * The composer forces `NoToneMapping` on the renderer and applies AgX in a pass.
 * `agx` is true only when both of those are in place.
 */
export function readComposerTone(
  renderer: { toneMapping: number },
  composer: { multisampling?: number; passes: readonly object[] },
): ComposerToneState {
  const passes: string[] = [];
  let agxEffect = false;
  for (const pass of composer.passes) {
    const effects = (pass as { effects?: readonly object[] }).effects;
    if (!effects) {
      passes.push(pass.constructor.name);
      continue;
    }
    for (const effect of effects) {
      passes.push(effect.constructor.name);
      if (effect instanceof ToneMappingEffect && effect.mode === COMPOSER_TONE_MODE) agxEffect = true;
    }
  }
  return {
    rendererToneMapping: renderer.toneMapping,
    agx: renderer.toneMapping === NoToneMapping && agxEffect,
    multisampling: composer.multisampling ?? 0,
    passes,
  };
}
