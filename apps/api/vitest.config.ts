import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const migrationsPath = fileURLToPath(new URL('../../packages/db/migrations', import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(migrationsPath);
      return {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            // Applied by test/setup.ts before each test file.
            TEST_MIGRATIONS: migrations,
            // Placeholder secrets: Clerk is mocked and outbound fetch is stubbed in tests.
            CLERK_JWT_KEY: 'test-jwt-key',
            DEEPINFRA_API_KEY: 'test-deepinfra-key',
            ALLOWED_ORIGINS: 'https://app.example.com,https://*.preview.example.com',
            // Small cap so the quota path is testable without seeding hundreds of rows.
            DAILY_TURN_LIMIT: '5',
          },
        },
      };
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
