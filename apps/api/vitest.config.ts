import { defineConfig } from "vitest/config";

/**
 * Two projects:
 *  - unit: pure logic and services with fakes, no I/O (`src/**\/*.spec.ts`)
 *  - e2e: the real app over HTTP against the fitlens_test database (`test/**\/*.e2e.spec.ts`)
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", globals: true, environment: "node", include: ["src/**/*.spec.ts"] },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          globals: true,
          environment: "node",
          include: ["test/**/*.e2e.spec.ts"],
          globalSetup: ["test/support/global-setup.ts"],
          // One database: files run one at a time; tests isolate by creating their own users.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
