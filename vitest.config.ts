import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/contract/**/*.test.ts', 'tests/unit/**/*.test.ts'], testTimeout: 120_000, hookTimeout: 60_000 },
});
