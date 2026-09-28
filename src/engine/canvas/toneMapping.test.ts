import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { EffectComposer, EffectPass, ToneMappingEffect } from 'postprocessing';
import { NoToneMapping, PerspectiveCamera } from 'three';
import { PostStack } from '@/engine/quality/QualityDirector';
import { qualityProfiles } from '@/engine/quality/profiles';
import { COMPOSER_TONE_MODE, readComposerTone } from '@/engine/quality/toneState';

function toneModes(node: ReactNode): number[] {
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ mode?: number; children?: ReactNode }>;
  const found = typeof element.props.mode === 'number' ? [element.props.mode] : [];
  const children = element.props.children;
  const list = Array.isArray(children) ? children : children ? [children] : [];
  return found.concat(list.flatMap((child) => toneModes(child)));
}

describe('AgX through the composer', () => {
  it('applies AgX on the composer while the renderer tone mapping is off', () => {
    const composer = new EffectComposer(undefined);
    const effect = new ToneMappingEffect({ mode: COMPOSER_TONE_MODE });
    const pass = new EffectPass(new PerspectiveCamera(), effect);
    composer.passes.push(pass);
    const renderer = { toneMapping: NoToneMapping };
    const state = readComposerTone(renderer, composer);
    expect(state.rendererToneMapping).toBe(NoToneMapping);
    expect(state.agx).toBe(true);
    expect(state.passes).toContain('ToneMappingEffect');
    expect(effect.mode).toBe(COMPOSER_TONE_MODE);
    expect(toneModes(PostStack({ profile: qualityProfiles.LOW }))).toContain(COMPOSER_TONE_MODE);
    expect(toneModes(PostStack({ profile: qualityProfiles.HIGH }))).toContain(COMPOSER_TONE_MODE);

    for (const item of composer.passes) item.dispose();
    composer.inputBuffer.dispose();
    composer.outputBuffer.dispose();
  });
});
