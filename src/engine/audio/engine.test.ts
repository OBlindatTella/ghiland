import { describe, expect, it } from 'vitest';
import { audioEngine } from '@/engine/audio/engine';
import { seasideAudio } from '@/worlds/seaside-house/audio';

describe('world audio lifecycle', () => {
  it('takes bed ids from the world spec and stop leaves nothing running', () => {
    expect(seasideAudio.beds.map((bed) => bed.id)).toEqual(['ocean', 'wind']);
    expect(seasideAudio.emitters?.map((emitter) => emitter.id)).toEqual(['gull']);
    audioEngine.stop();
    audioEngine.stop();
    const debug = audioEngine.debug();
    expect(debug.sources).toEqual([]);
    expect(debug.decodedBytes).toBe(0);
    expect(debug.running).toBe(false);
  });
});
