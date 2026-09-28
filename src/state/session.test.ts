import { beforeEach, describe, expect, it } from 'vitest';
import { useSession } from '@/state/session';

describe('load progress', () => {
  beforeEach(() => {
    useSession.setState({
      phase: 'landing',
      worldId: null,
      worldPhase: 'idle',
      loadProgress: 0,
      stall: 'ok',
      forceLow: false,
    });
  });

  it('only moves forward, then stays active', () => {
    useSession.getState().beginSeaside();
    useSession.getState().setProgress(0.4);
    useSession.getState().setProgress(0.2);
    expect(useSession.getState().loadProgress).toBe(0.4);
    useSession.getState().setProgress(1);
    expect(useSession.getState().worldPhase).toBe('ready');
    useSession.getState().markActive();
    useSession.getState().setProgress(0.36);
    const state = useSession.getState();
    expect(state.phase).toBe('inWorld');
    expect(state.worldPhase).toBe('active');
    expect(state.loadProgress).toBe(1);
  });
});