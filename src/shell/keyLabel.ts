import type { KeyBinding } from '@/contracts/input';
import { defaultBindings } from '@/engine/input/bindings';

/** Physical code to the character printed on that key. QWERTY is the fallback when no layout map exists. */
export function labelForCode(code: string, layout: ReadonlyMap<string, string> | null): string {
  const mapped = layout?.get(code);
  if (mapped) return mapped.length === 1 ? mapped.toUpperCase() : mapped;
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  return code;
}

export function screenKeyLabel(
  layout: ReadonlyMap<string, string> | null,
  bindings: readonly KeyBinding[] = defaultBindings,
): string {
  const code = bindings.find((item) => item.action === 'toggleScreen')?.codes[0];
  if (!code) return '';
  return labelForCode(code, layout);
}
