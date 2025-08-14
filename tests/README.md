# RLS Trust Pattern Testing Suite

This directory contains comprehensive tests for the RLS (Row Level Security) trust pattern implementation across all API routes.

## Test Structure

### 🔒 Security Tests

#### `api-integration/rls-trust-pattern.test.ts`
**Core authorization tests** verifying that RLS policies correctly enforce access control:
- Expert access to own resources
- Admin access to all resources  
- Learner access restrictions
- Cross-user access prevention
- Information disclosure prevention
- Authorization matrix validation

#### `api-integration/rls-edge-cases.test.ts` 
**Edge case and boundary tests** covering unusual scenarios:
- Token expiration and refresh
- Concurrent operations and race conditions
- SQL injection prevention
- Large data handling
- Role transition scenarios
- Null/undefined value handling
- Invalid UUID and input validation

#### `api-integration/rls-performance.test.ts`
**Performance and load tests** ensuring RLS doesn't impact performance:
- Single request response times
- Batch operation efficiency  
- Authorization overhead measurement
- Stress testing with concurrent requests
- Memory leak prevention

#### `api-integration/availability-windows.test.ts`
**Original functionality tests** ensuring business logic is preserved:
- Database connection validation
- Table structure verification
- Basic CRUD operations

## Test Execution

### Quick Test Run
```bash
# Run core RLS authorization tests only
npm run test:rls-quick

# Run specific test file
npm run test:run tests/api-integration/rls-trust-pattern.test.ts
```

### Comprehensive Test Suite
```bash
# Run all RLS tests and generate security report
npm run test:rls

# This will:
# 1. Execute all test suites
# 2. Generate performance metrics
# 3. Create a detailed security report
# 4. Output results to tests/reports/
```

### Individual Test Files
```bash
# Core authorization tests
npm run test:run tests/api-integration/rls-trust-pattern.test.ts

# Edge case tests  
npm run test:run tests/api-integration/rls-edge-cases.test.ts

# Performance tests
npm run test:run tests/api-integration/rls-performance.test.ts

# Basic functionality tests
npm run test:run tests/api-integration/availability-windows.test.ts
```

## Environment Setup

### Required Environment Variables

Create `.env.local` with:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
API_BASE_URL=http://localhost:3000  # For local testing
```

### Database Requirements

The tests require a Supabase database with:
- RLS policies enabled
- User profiles, expert profiles, availability windows, and expert sessions tables
- Appropriate RLS policies configured:
  - "Experts can manage own availability windows"
  - "Learners can view open availability windows"  
  - "Admins can manage all availability windows"
  - Similar policies for expert_sessions

## Test Categories

### 🛡️ Security Testing
- Authorization matrix validation
- Information disclosure prevention
- Token security and validation
- SQL injection prevention
- Error message security

### ⚡ Performance Testing  
- Response time measurement
- Concurrent request handling
- Memory usage monitoring
- Database query optimization
- Authorization overhead analysis

### 🎯 Functional Testing
- Business logic validation
- Data integrity checks
- Error handling verification
- Edge case coverage
- Integration testing

## Test Results and Reporting

### Generated Reports

Test execution generates detailed reports in `tests/reports/`:
- `rls-security-test-report.md` - Comprehensive security analysis
- Performance metrics and benchmarks
- Security vulnerability assessment
- Deployment readiness evaluation

### Key Metrics Tracked

1. **Security Metrics**
   - Authorization success/failure rates
   - Information disclosure attempts blocked
   - Admin privilege verification
   - Cross-user access prevention

2. **Performance Metrics**
   - Average response times
   - 95th percentile response times
   - Concurrent request handling
   - Database query efficiency

3. **Quality Metrics**
   - Test coverage percentage
   - Code quality improvements
   - Error handling effectiveness
   - Business logic preservation

## Test Data Management

### Test User Creation
Tests automatically create and clean up:
- Expert users with profiles
- Learner users with profiles  
- Admin users with profiles
- Test availability windows
- Test expert sessions

### Data Isolation
- Each test suite uses unique test data
- Automatic cleanup prevents test interference
- Service role used for test data management
- No impact on production data

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loaded**
   ```
   Error: Missing Supabase environment variables
   ```
   - Ensure `.env.local` exists with correct values
   - Check variable names match exactly

2. **Database Connection Failures**
   ```
   Error: Cannot connect to Supabase
   ```
   - Verify Supabase URL and keys are correct
   - Check database is running and accessible
   - Ensure RLS policies are properly configured

3. **Permission Errors**
   ```
   Error: Insufficient permissions
   ```
   - Verify service role key has correct permissions
   - Check RLS policies are enabled
   - Ensure test users have correct roles

4. **Test Timeout Issues**
   ```
   Error: Test timeout exceeded
   ```
   - Increase test timeout in vitest.config.ts
   - Check database performance
   - Verify network connectivity

### Debug Mode

Enable verbose logging:
```bash
DEBUG=true npm run test:rls
```

## CI/CD Integration

### GitHub Actions Setup
```yaml
- name: Run RLS Security Tests
  run: npm run test:rls
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Quality Gates

Tests should pass these criteria:
- All security tests pass (100%)
- Performance within acceptable thresholds
- No information disclosure vulnerabilities
- Proper error handling verified
- Business logic preservation confirmed

## Security Considerations

### Test Security
- Tests use isolated test environment
- Service role access is minimized
- Test data is automatically cleaned up
- No production data is used or affected

### Production Readiness
- All tests must pass before deployment
- Security report must show no vulnerabilities
- Performance must meet acceptable thresholds
- Admin access must be properly verified

## Contributing

### Adding New Tests

1. **Security Tests**: Add to `rls-trust-pattern.test.ts`
2. **Edge Cases**: Add to `rls-edge-cases.test.ts`
3. **Performance**: Add to `rls-performance.test.ts`
4. **New API Routes**: Create new test file following naming convention

### Test Writing Guidelines

1. **Test Isolation**: Each test should be independent
2. **Clear Naming**: Test names should describe the scenario
3. **Proper Cleanup**: Always clean up test data
4. **Error Testing**: Test both success and failure cases
5. **Performance**: Include timing measurements for key operations

---

*For detailed security analysis results, see `tests/reports/rls-security-test-report.md`*