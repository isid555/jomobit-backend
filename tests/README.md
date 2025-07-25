# Test Suite Documentation

This document describes the comprehensive testing suite for the Jomobit Backend API.

## Overview

The test suite is organized into multiple layers to ensure comprehensive coverage:

- **Unit Tests**: Test individual functions and methods in isolation
- **Integration Tests**: Test interactions between components and external services
- **End-to-End Tests**: Test complete user workflows
- **Performance Tests**: Test system performance under load

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── controllers/         # Controller tests
│   ├── middleware/          # Middleware tests
│   ├── models/             # Model tests
│   ├── services/           # Service tests
│   │   └── aiProviders/    # AI provider tests
│   ├── security/           # Security tests
│   └── utils/              # Utility tests
├── integration/            # Integration tests
│   ├── database/           # Database operation tests
│   └── webhooks/           # Webhook processing tests
├── e2e/                    # End-to-end tests
├── performance/            # Performance tests
├── fixtures/               # Test data and factories
└── setup/                  # Test configuration
```

## Running Tests

### Prerequisites

1. Node.js 18 or higher
2. MongoDB (for integration tests, or MongoDB Memory Server will be used)
3. Redis (for integration tests)

### Setup

```bash
# Make setup script executable and run
chmod +x scripts/test-setup.sh
./scripts/test-setup.sh
```

### Test Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:performance  # Performance tests only

# Run with coverage
npm run test:coverage

# Run in watch mode (development)
npm run test:watch

# Run for CI
npm run test:ci
```

## Test Configuration

### Jest Configuration

The test suite uses Jest with the following key configurations:

- **Test Environment**: Node.js
- **Setup Files**: Global setup and teardown for MongoDB Memory Server
- **Coverage**: Configured with thresholds (70% minimum)
- **Timeout**: 30 seconds for database operations
- **Mocking**: Automatic mock clearing between tests

### Environment Variables

Tests require the following environment variables:

```bash
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/jomobit-test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret
AUTH0_DOMAIN=test.auth0.com
AUTH0_AUDIENCE=test-audience
# ... additional service keys for testing
```

## Test Data Management

### Test Data Factory

The `TestDataFactory` class provides consistent test data creation:

```javascript
const { TestDataFactory } = require('./fixtures/testData');

// Create test user
const userData = TestDataFactory.createUserData();
const user = await User.create(userData);

// Create business profile
const profileData = TestDataFactory.createBusinessProfileData(user._id);
const profile = await BusinessProfile.create(profileData);
```

### Mock Data

Mock webhook payloads and external service responses are provided in `fixtures/testData.js`.

## Unit Tests

Unit tests focus on testing individual components in isolation:

### Service Tests
- Credit management operations
- User management
- Business profile operations
- Template management
- AI provider integrations
- Subscription handling

### Controller Tests
- Request/response handling
- Input validation
- Error handling
- Authentication/authorization

### Middleware Tests
- Authentication middleware
- Validation middleware
- Error handling middleware
- Security middleware

### Model Tests
- Schema validation
- Model methods
- Database constraints

## Integration Tests

Integration tests verify component interactions:

### Database Operations
- ACID transaction compliance
- Concurrent operation handling
- Data integrity
- Performance under load

### Webhook Processing
- Auth0 user synchronization
- Razorpay payment processing
- AI provider completion handling
- Security validation

## End-to-End Tests

E2E tests verify complete user workflows:

### User Onboarding
1. User registration via Auth0 webhook
2. Default credit allocation
3. Profile creation
4. Template browsing

### Poster Generation
1. Generation initiation
2. Credit reservation
3. AI processing simulation
4. Webhook completion
5. Credit deduction
6. Result retrieval

### Subscription Management
1. Plan selection
2. Payment processing
3. Credit allocation
4. Subscription management
5. Cancellation handling

## Performance Tests

Performance tests ensure system scalability:

### Credit System Performance
- High-volume concurrent reservations
- ACID compliance under load
- Credit expiration processing

### Generation Service Performance
- Concurrent generation requests
- Webhook processing throughput
- Database query performance

### Resource Usage
- Memory leak detection
- Connection pool management
- Query optimization

## Coverage Requirements

The test suite maintains the following coverage thresholds:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Coverage Reports

Coverage reports are generated in multiple formats:

- **Console**: Summary during test runs
- **HTML**: Detailed interactive report in `coverage/html/`
- **LCOV**: For CI integration in `coverage/lcov.info`
- **JSON**: Machine-readable format in `coverage/coverage.json`

## Continuous Integration

### GitHub Actions

The CI pipeline runs:

1. **Matrix Testing**: Node.js 18.x and 20.x
2. **Service Dependencies**: MongoDB and Redis containers
3. **Test Execution**: Unit, integration, and E2E tests
4. **Coverage Reporting**: Codecov and Coveralls integration
5. **Performance Testing**: Separate job for performance validation

### Quality Gates

Tests must pass the following quality gates:

- All test suites pass
- Coverage thresholds met
- No security vulnerabilities
- Performance benchmarks met

## Best Practices

### Writing Tests

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Isolation**: Each test should be independent
3. **Descriptive Names**: Test names should describe the scenario
4. **Mock External Services**: Use mocks for third-party APIs
5. **Clean Up**: Ensure proper cleanup after tests

### Test Data

1. **Use Factories**: Consistent test data creation
2. **Avoid Hard-coding**: Use dynamic data generation
3. **Clean State**: Start each test with clean state
4. **Realistic Data**: Use realistic but safe test data

### Performance Testing

1. **Baseline Metrics**: Establish performance baselines
2. **Load Simulation**: Test realistic load scenarios
3. **Resource Monitoring**: Monitor memory and CPU usage
4. **Bottleneck Identification**: Identify performance bottlenecks

## Troubleshooting

### Common Issues

1. **MongoDB Connection**: Ensure MongoDB is running or Memory Server is configured
2. **Redis Connection**: Check Redis availability for integration tests
3. **Timeout Issues**: Increase timeout for slow operations
4. **Memory Issues**: Use `--max-old-space-size` for large test suites

### Debug Mode

Run tests with debug information:

```bash
DEBUG=* npm test
NODE_OPTIONS="--inspect" npm test
```

### Test Isolation

If tests are interfering with each other:

```bash
npm test -- --runInBand  # Run tests serially
npm test -- --maxWorkers=1  # Limit concurrency
```

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep test dependencies current
2. **Review Coverage**: Ensure coverage remains adequate
3. **Performance Monitoring**: Track performance trends
4. **Test Data Refresh**: Update test data as needed

### Adding New Tests

When adding new features:

1. Write unit tests for new functions
2. Add integration tests for new workflows
3. Update E2E tests for user-facing changes
4. Consider performance implications

## Metrics and Reporting

### Test Metrics

- Test execution time
- Coverage percentages
- Failure rates
- Performance benchmarks

### Reporting

- Coverage reports uploaded to Codecov/Coveralls
- Performance results stored as CI artifacts
- Test results integrated with GitHub status checks

## Support

For questions about the test suite:

1. Check this documentation
2. Review existing test examples
3. Consult the team's testing guidelines
4. Create an issue for test infrastructure problems