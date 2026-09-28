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
      loadError: null,
      loadAttempt: 0,
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

  it('keeps a failed load on screen until Retry or Back', () => {
    useSession.getState().beginSeaside();
    useSession.getState().failLoad();
    expect(useSession.getState().loadError).toBe("This place didn't arrive.");
    expect(useSession.getState().phase).toBe('loading');
    const attempt = useSession.getState().loadAttempt;
    useSession.getState().retryLoad();
    expect(useSession.getState().loadError).toBeNull();
    expect(useSession.getState().loadAttempt).toBe(attempt + 1);
    expect(useSession.getState().worldPhase).toBe('loading');
    useSession.getState().backToLanding();
    expect(useSession.getState().phase).toBe('landing');
    expect(useSession.getState().worldId).toBeNull();
  });
});