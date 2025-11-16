# Testing Guide

This project uses **Jest** and **React Testing Library** for testing.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

## Test Structure

- `__tests__/` - Test files
  - `lib/` - Utility function tests
  - `components/` - Component tests
  - `metadata/` - Metadata validation tests

## Writing Tests

### Component Tests

```tsx
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('should render correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

### Utility Function Tests

```ts
import { myFunction } from '@/lib/utils'

describe('myFunction', () => {
  it('should work correctly', () => {
    expect(myFunction('input')).toBe('expected output')
  })
})
```

## Test Coverage

We aim for:
- **50% minimum** coverage for branches, functions, lines, and statements
- **Higher coverage** for critical paths (contracts, utilities)

## Best Practices

1. **Test behavior, not implementation** - Focus on what the component/function does, not how
2. **Use descriptive test names** - "should render button with text" not "test1"
3. **Keep tests simple** - One assertion per test when possible
4. **Mock external dependencies** - Blockchain calls, API calls, etc.
5. **Test edge cases** - Empty states, error states, boundary conditions

## CI/CD

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

The CI will fail if:
- Tests fail
- Coverage drops below threshold
- Linter errors exist

