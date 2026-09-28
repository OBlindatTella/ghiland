export const MOCK_LABEL = 'This chat is a mock. Nothing is sent over the network.';

const LINES = [
  'I can only keep you company. The sea is still outside.',
  'Nothing left this browser. Notes will keep it if you want it kept.',
  'That sounds calm enough to leave on the desk.',
];

export function mockReply(text: string): string {
  const index = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % LINES.length;
  return LINES[index] ?? LINES[0];
}

export interface ChatLine {
  role: 'you' | 'mock';
  text: string;
}

export const chatMemory: { lines: ChatLine[] } = { lines: [] };
