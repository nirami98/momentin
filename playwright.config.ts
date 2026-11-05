import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5178', headless: true },
  webServer: { command: 'npm run dev:web:test', url: 'http://127.0.0.1:5178', reuseExistingServer: false },
});
