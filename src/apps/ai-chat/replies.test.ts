import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOCK_LABEL, mockReply } from './replies';

describe('chat mock', () => {
  it('answers from a fixed list and never calls the network', () => {
    expect(mockReply('hello')).toBe(mockReply('hello'));
    expect(MOCK_LABEL.toLowerCase()).toContain('mock');
    const source = readFileSync(new URL('./Chat.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('WebSocket');
  });
});
