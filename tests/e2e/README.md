# GhostSpeak v2 E2E Testing

End-to-end tests for GhostSpeak v2 using Playwright (2026 standards).

## Architecture

- **Framework**: Playwright 1.57.0
- **Language**: TypeScript
- **Runner**: Bun
- **Server**: Next.js 15.4 (App Router)
- **Browsers**: Chromium, Firefox, WebKit + Mobile (local only)

## Configuration (2026 Standards)

### Timeouts
- **Global timeout**: 30s per test
- **Action timeout**: 10s for user actions
- **Navigation timeout**: 30s for page loads
- **Assertion timeout**: 10s for expect statements

### Artifacts
- **Screenshots**: Only on failure
- **Videos**: Retained on failure (CI) / Off (local)
- **Traces**: Retained on failure (CI) / Always (local)
- **Reports**: HTML + JUnit (CI)

### Execution
- **Parallel**: Enabled locally, disabled in CI
- **Retries**: 2 in CI, 0 locally
- **Workers**: 1 in CI, auto-scaled locally
- **Mobile testing**: Enabled locally for Pixel 7 & iPhone 15

## Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run with UI mode
bun run test:e2e:ui

# Run specific test
bun run test:e2e --grep "homepage"

# Run only Chromium
bun run test:e2e --project=chromium

# Debug mode
bun run test:e2e --debug
```

## Test Structure

```
tests/e2e/
├── setup.ts          # Global test setup
├── example.spec.ts   # Basic example tests
└── README.md         # This file
```

## Best Practices (2026)

### Test Organization
- Use semantic selectors (`data-testid`, roles, labels)
- Avoid brittle locators (XPath, dynamic IDs, deep CSS)
- Keep tests independent with proper isolation
- Use Page Object Model for complex interactions

### Reliability
- Let Playwright handle auto-waiting
- Avoid `sleep()` - use proper assertions
- Mock external dependencies for determinism
- Test user-visible behavior, not implementation

### Debugging
- Use traces for timeline analysis
- Screenshots/videos for visual debugging
- Network panel for API debugging
- Codegen for locator discovery

## CI/CD Integration

Tests automatically:
- Build Next.js in production mode
- Start server on port 3333
- Run with single worker (resource constraints)
- Generate JUnit reports
- Retain failure artifacts

## Environment Variables

```env
# Base URL override (optional)
PLAYWRIGHT_BASE_URL=http://localhost:3333

# CI detection
CI=true  # Enables CI-specific configuration
```

## Future Enhancements

- Authentication state reuse
- Visual regression testing
- API mocking setup
- Performance monitoring
- Accessibility testing