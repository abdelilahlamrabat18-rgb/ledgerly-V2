import { defineConfig } from 'vitest/config';

// Scope test discovery to this project only. Without this config vitest's
// default include pattern also scans Agent Manager worktrees under
// .kilo/worktrees/, which contain stale copies of the repository and would
// run tests against outdated files.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});