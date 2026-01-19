import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const port = 3333
const baseURL = `http://localhost:${port}`

export default defineConfig({
  // Test discovery and execution
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',

  // Parallel execution
  fullyParallel: !isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,

  // Timeouts (2026 standards)
  timeout: 30 * 1000, // 30s global timeout
  expect: {
    timeout: 10 * 1000, // 10s for assertions
  },

  // Modern reporter configuration
  reporter: isCI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'html-report' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'html-report' }],
      ],

  // Global test configuration
  use: {
    baseURL,
    actionTimeout: 10 * 1000, // 10s for actions
    navigationTimeout: 30 * 1000, // 30s for navigation

    // Artifact configuration (2026 best practices)
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
    trace: isCI ? 'retain-on-failure' : 'on',

    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  // Browser projects with modern device configurations
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: isCI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
        }
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing (2026 standard)
    ...(isCI ? [] : [
      {
        name: 'mobile-chrome',
        use: { ...devices['Pixel 7'] },
      },
      {
        name: 'mobile-safari',
        use: { ...devices['iPhone 15'] },
      }
    ])
  ],

  // Web server configuration for Next.js 15.4
  webServer: {
    command: isCI
      ? 'bun run build && bun run start'
      : 'bun run dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120 * 1000, // 2 minutes for server startup
    cwd: process.cwd(),
  },

  // Global setup/teardown (optional for future auth setup)
  // globalSetup: require.resolve('./tests/setup/global-setup'),
  // globalTeardown: require.resolve('./tests/setup/global-teardown'),

  // Test tagging and metadata (2026 features)
  metadata: {
    project: 'GhostSpeak v2',
    version: '2.0.0',
    environment: isCI ? 'ci' : 'local'
  }
})
