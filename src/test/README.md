# Unit Tests for App.tsx

This directory contains comprehensive unit tests for the Focus Flow application's main App component.

## Test Setup

The tests use the following testing stack:
- **Vitest** - Fast unit test framework
- **React Testing Library** - Testing utilities for React components
- **@testing-library/jest-dom** - Custom matchers for DOM elements
- **@testing-library/user-event** - User interaction simulation

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm test -- --run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The test suite includes **34 comprehensive tests** covering:

### Initial Render (6 tests)
- App header and title rendering
- Active session status display
- Default session loading
- Authentication buttons display
- Daily progress section rendering
- Streak counter display

### Session Management (4 tests)
- Adding new sessions
- Loading sessions from localStorage
- Handling corrupted localStorage data
- Saving sessions to localStorage

### Navigation and Authentication (2 tests)
- Navigation to login page
- Navigation to register page

### Settings Menu (3 tests)
- Opening settings menu
- Closing settings menu
- Updating reset time preferences

### Daily Progress (4 tests)
- Displaying streak from localStorage
- Displaying yesterday's minutes
- Resetting daily progress
- Calculating total daily goals

### Accessibility (2 tests)
- Proper heading structure
- Accessible button elements

### Edge Cases (4 tests)
- Handling empty sessions array
- Handling missing localStorage values
- Handling invalid localStorage values
- Generating unique session IDs

### Audio (2 tests)
- Audio element presence
- Audio source configuration

### Responsive Design (2 tests)
- Grid layout classes
- Mobile-friendly navigation

### State Persistence (3 tests)
- Persisting reset time
- Loading reset time on mount
- Persisting last reset date

### Component Integration (2 tests)
- ProgressRing component rendering
- SessionCard components rendering

## Test Configuration

The test configuration is defined in:
- `vitest.config.ts` - Vitest configuration
- `src/test/setup.ts` - Test setup and mocks

### Mocked Dependencies

The following dependencies are mocked for testing:
- **Firebase Auth** - Authentication functionality
- **react-router-dom** - Navigation
- **localStorage** - Browser storage
- **HTMLMediaElement** - Audio playback

## Writing New Tests

When adding new tests, follow these patterns:

1. **Arrange** - Set up test data and render the component
2. **Act** - Perform user interactions
3. **Assert** - Verify expected outcomes

Example:
```typescript
it('should do something when user clicks button', async () => {
  // Arrange
  const user = userEvent.setup();
  renderApp();
  
  // Act
  const button = screen.getByRole('button', { name: /click me/i });
  await user.click(button);
  
  // Assert
  expect(screen.getByText('Expected Result')).toBeInTheDocument();
});
```

## Best Practices

- Use `screen.getByRole()` for better accessibility testing
- Use `waitFor()` for asynchronous operations
- Clear mocks and localStorage between tests
- Test user interactions, not implementation details
- Keep tests focused and readable

## Troubleshooting

### Tests timing out
- Increase timeout in `waitFor()` options
- Check for pending promises or timers

### Can't find elements
- Use `screen.debug()` to see current DOM
- Check if element is behind async operation
- Verify query selectors are correct

### Mock issues
- Ensure mocks are defined before imports
- Clear mocks between tests in `beforeEach()`
