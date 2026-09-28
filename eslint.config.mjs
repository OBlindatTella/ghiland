import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const sharedBoundary = [
  {
    group: [
      '@/apps',
      '@/apps/**',
      '@/shell',
      '@/shell/**',
      '@/state',
      '@/state/**',
      '@/lib',
      '@/lib/**',
    ],
    message:
      'Worlds and apps may import only @/contracts/*, @/ui/*, and the public @/engine entry.',
  },
  {
    group: ['@/engine/*', '@/engine/*/**'],
    message: 'Import the engine only through @/engine (engine/index.ts), not internal modules.',
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'coverage/**']),
  {
    files: ['src/engine/**/*.{ts,tsx}', 'src/worlds/**/*.{ts,tsx}'],
    rules: {
      // R3F props (args, attach) are not DOM attributes.
      'react/no-unknown-property': 'off',
      // useFrame mutates the three.js camera and renderer. Those objects are not React state.
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['src/worlds/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...sharedBoundary,
            {
              group: ['@/worlds/*', '@/worlds/*/**'],
              message: 'A world cannot import another world.',
            },
            {
              regex: '^\\.\\./',
              message:
                'Stay inside this world folder. Do not import sibling worlds or the registry.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/apps/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...sharedBoundary,
            {
              group: ['@/worlds', '@/worlds/**'],
              message: 'Apps cannot import worlds.',
            },
            {
              regex: '^\\.\\./',
              message: 'Stay inside this app folder. Do not import sibling apps or the registry.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
