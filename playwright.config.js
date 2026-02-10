const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8085',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // Let Playwright manage the server lifecycle
  webServer: {
    command: 'npx serve _site -l 8085',
    url: 'http://localhost:8085',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
