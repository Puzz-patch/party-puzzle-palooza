import { defineConfig } from 'vitest';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
}); 