# Testing Configuration Documentation

## CRITICAL TESTING SETUP REQUIREMENTS

This document defines the mandatory testing configuration to prevent the critical failures discovered in comprehensive testing analysis.

## 🚨 CRITICAL CONFIGURATION FAILURES TO PREVENT

### 1. Empty Test Database Failures
**Problem**: Tests failed because database had no seed data for booking flows.
**Solution**: Mandatory test data seeding and database state validation.

### 2. Mock vs Real Database Testing
**Problem**: Tests used mocks instead of real database connections, missing integration failures.
**Solution**: Real database testing with proper isolation and cleanup.

### 3. Build Configuration Errors
**Problem**: Vitest configuration issues caused build failures.
**Solution**: Validated test configurations with proper setup.

### 4. Environment Variable Mismatches
**Problem**: Test environment didn't match production configuration.
**Solution**: Environment parity validation and configuration testing.

## 📊 TEST ENVIRONMENT SETUP

### Database Configuration

#### Test Database Requirements
```bash
# REQUIRED: Separate test database instance
NEXT_PUBLIC_SUPABASE_URL_TEST=your-test-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY_TEST=your-test-service-key

# CRITICAL: Never use production database for testing
# Must be completely separate Supabase project
```

#### Database State Management
```bash
# Before each test suite
npm run test:db:reset      # Reset database to clean state
npm run test:db:seed       # Seed with required baseline data
npm run test:db:validate   # Verify data integrity

# After each test suite
npm run test:db:cleanup    # Clean up test artifacts
npm run test:db:verify     # Verify no data pollution
```

### Test Data Fixtures

#### Required Baseline Data
Every test run MUST start with this minimum data set:

1. **User Accounts**
   - 1 Admin user (verified email)
   - 2 Expert users (verified email, complete profiles)
   - 3 Learner users (verified email)

2. **Expert Data**
   - Expert profiles with complete information
   - Business specialties assigned
   - Stripe Connect accounts (test mode)

3. **Sessions Data**
   - 5+ expert sessions across different specialties
   - Various price points and durations
   - Different difficulty levels

4. **Availability Data**
   - Current availability windows for all experts
   - Future availability (next 30 days)
   - Some past availability for testing

5. **Reference Data**
   - Business specialties lookup data
   - Valid difficulty levels
   - Payment method test data

#### Test Data Seeding Script
```typescript
// tests/fixtures/seed-test-data.ts
export async function seedTestDatabase() {
  const supabase = await createServerSideClient()
  
  // 1. Verify clean state
  await verifyCleanDatabase(supabase)
  
  // 2. Create base users
  const users = await createTestUsers(supabase)
  
  // 3. Create expert profiles
  const experts = await createExpertProfiles(supabase, users)
  
  // 4. Create sessions
  const sessions = await createTestSessions(supabase, experts)
  
  // 5. Create availability windows
  await createAvailabilityWindows(supabase, experts)
  
  // 6. Verify data integrity
  await verifyTestDataIntegrity(supabase)
  
  return { users, experts, sessions }
}
```

## 🔧 VITEST CONFIGURATION

### Separate Test Configurations

#### Schema Validation Tests
```typescript
// vitest.schema.config.ts
export default defineConfig({
  test: {
    name: 'schema-validation',
    include: ['tests/schema-validation/**/*.test.ts'],
    testTimeout: 30000,
    setupFiles: ['./tests/setup-schema-tests.ts'],
    environment: 'node',
    // No browser needed for schema tests
  }
})
```

#### Integration Tests
```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    name: 'integration',
    include: ['tests/api-integration/**/*.test.ts'],
    testTimeout: 60000,
    setupFiles: ['./tests/setup-integration-tests.ts'],
    environment: 'node',
    // Real database connections required
  }
})
```

#### E2E Tests
```typescript
// vitest.e2e.config.ts
export default defineConfig({
  test: {
    name: 'e2e',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 120000,
    setupFiles: ['./tests/setup-e2e-tests.ts'],
    environment: 'node',
    maxConcurrency: 1, // Prevent database conflicts
  }
})
```

#### Error Detection Tests
```typescript
// vitest.error-detection.config.ts
export default defineConfig({
  test: {
    name: 'error-detection',
    include: ['tests/error-detection/**/*.test.ts'],
    testTimeout: 45000,
    setupFiles: ['./tests/setup-error-detection.ts'],
    environment: 'node',
  }
})
```

### Build Validation Configuration
```typescript
// vitest.build.config.ts
export default defineConfig({
  test: {
    name: 'build-validation',
    include: ['tests/build-validation/**/*.test.ts'],
    testTimeout: 30000,
    environment: 'node',
    // Tests that verify build configurations work
  }
})
```

## 🛠️ SETUP FILES

### Schema Test Setup
```typescript
// tests/setup-schema-tests.ts
import { beforeAll, afterAll } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

beforeAll(async () => {
  // Verify database connection
  const supabase = await createServerSideClient()
  const { data, error } = await supabase.from('users').select('count').limit(1)
  if (error) {
    throw new Error(`Database connection failed: ${error.message}`)
  }
  console.log('✓ Schema tests: Database connection verified')
})

afterAll(async () => {
  // No cleanup needed for schema validation tests
  console.log('✓ Schema tests: Completed')
})
```

### Integration Test Setup
```typescript
// tests/setup-integration-tests.ts
import { beforeAll, afterAll, beforeEach } from 'vitest'
import { seedTestDatabase, cleanupTestDatabase } from './fixtures/seed-test-data'

beforeAll(async () => {
  console.log('🔄 Setting up integration test environment...')
  await seedTestDatabase()
  console.log('✓ Integration tests: Database seeded')
})

beforeEach(async () => {
  // Reset any modified data between tests
  await resetModifiedData()
})

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...')
  await cleanupTestDatabase()
  console.log('✓ Integration tests: Database cleaned')
})
```

### E2E Test Setup
```typescript
// tests/setup-e2e-tests.ts
import { beforeAll, afterAll } from 'vitest'
import { seedCompleteTestDatabase, verifyE2ERequirements } from './fixtures/e2e-fixtures'

beforeAll(async () => {
  console.log('🚀 Setting up E2E test environment...')
  
  // Seed comprehensive test data for full user journeys
  await seedCompleteTestDatabase()
  
  // Verify all requirements for E2E testing
  await verifyE2ERequirements()
  
  console.log('✓ E2E tests: Environment ready')
})

afterAll(async () => {
  console.log('🧹 Cleaning up E2E test environment...')
  await cleanupCompleteTestDatabase()
  console.log('✓ E2E tests: Environment cleaned')
})
```

## 📦 TEST SCRIPTS CONFIGURATION

### Package.json Test Scripts
```json
{
  "scripts": {
    "test:schema": "vitest --config vitest.schema.config.ts run",
    "test:schema:watch": "vitest --config vitest.schema.config.ts",
    
    "test:integration": "vitest --config vitest.integration.config.ts run",
    "test:integration:watch": "vitest --config vitest.integration.config.ts",
    
    "test:e2e": "vitest --config vitest.e2e.config.ts run",
    "test:e2e:watch": "vitest --config vitest.e2e.config.ts",
    
    "test:error-detection": "vitest --config vitest.error-detection.config.ts run",
    "test:build-validation": "vitest --config vitest.build.config.ts run",
    
    "test:all": "npm run test:schema && npm run test:integration && npm run test:e2e && npm run test:error-detection",
    "test:critical": "npm run test:schema && npm run test:error-detection",
    
    "test:db:reset": "node scripts/reset-test-database.js",
    "test:db:seed": "node scripts/seed-test-database.js",
    "test:db:cleanup": "node scripts/cleanup-test-database.js",
    "test:db:validate": "node scripts/validate-test-database.js"
  }
}
```

## 🔒 ENVIRONMENT VALIDATION

### Environment Variable Validation
```typescript
// tests/utils/environment-validation.ts
export function validateTestEnvironment() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL_TEST',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST',
    'SUPABASE_SERVICE_ROLE_KEY_TEST',
    'STRIPE_SECRET_KEY_TEST',
    'STRIPE_PUBLISHABLE_KEY_TEST'
  ]
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar])
  
  if (missing.length > 0) {
    throw new Error(`Missing required test environment variables: ${missing.join(', ')}`)
  }
  
  // Verify test environment is not production
  if (process.env.NEXT_PUBLIC_SUPABASE_URL_TEST?.includes('production')) {
    throw new Error('Test environment must not use production database')
  }
  
  console.log('✓ Test environment variables validated')
}
```

### Database Environment Validation
```typescript
// tests/utils/database-validation.ts
export async function validateTestDatabase() {
  const supabase = await createServerSideClient()
  
  // Check database is accessible
  const { data, error } = await supabase.from('users').select('count').limit(1)
  if (error) {
    throw new Error(`Test database not accessible: ${error.message}`)
  }
  
  // Verify this is test database (not production)
  const { data: settings } = await supabase
    .from('app_settings')
    .select('environment')
    .limit(1)
  
  if (settings && settings[0]?.environment === 'production') {
    throw new Error('CRITICAL: Test pointing to production database!')
  }
  
  console.log('✓ Test database validated and safe')
}
```

## 🚀 CI/CD INTEGRATION

### GitHub Actions Configuration
```yaml
# .github/workflows/comprehensive-testing.yml
name: Comprehensive Testing

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Validate environment
      run: npm run test:validate-environment
      env:
        NEXT_PUBLIC_SUPABASE_URL_TEST: ${{ secrets.SUPABASE_URL_TEST }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
        SUPABASE_SERVICE_ROLE_KEY_TEST: ${{ secrets.SUPABASE_SERVICE_KEY_TEST }}
    
    - name: Setup test database
      run: npm run test:db:reset && npm run test:db:seed
    
    - name: Run schema validation tests
      run: npm run test:schema
    
    - name: Run error detection tests
      run: npm run test:error-detection
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Cleanup test environment
      run: npm run test:db:cleanup
      if: always()
```

## 📋 TESTING WORKFLOW

### Daily Development Workflow
```bash
# 1. Before starting work
npm run test:validate-environment
npm run test:db:reset
npm run test:db:seed

# 2. During development (after changes)
npm run test:critical          # Schema + error detection
npm run test:integration       # API integration tests

# 3. Before committing
npm run test:all              # Full test suite
npm run build                 # Verify build succeeds

# 4. After committing
# CI/CD runs comprehensive test suite automatically
```

### Database Schema Change Workflow
```bash
# 1. Before schema changes
npm run test:schema           # Baseline validation

# 2. After schema migration
npm run test:db:reset         # Reset with new schema
npm run test:db:seed          # Seed with new schema
npm run test:schema           # Verify schema changes
npm run test:integration      # Verify API compatibility

# 3. Update TypeScript types if needed
npm run generate:types        # Update database types
npm run test:build-validation # Verify types compile
```

## 🛡️ ERROR PREVENTION CHECKLIST

### Before Any Database Change
- [ ] Run schema validation tests
- [ ] Document expected changes
- [ ] Plan API code updates
- [ ] Update TypeScript interfaces
- [ ] Plan test data updates

### After Any Database Change
- [ ] Reset and seed test database
- [ ] Run schema validation tests
- [ ] Run API integration tests
- [ ] Verify foreign key relationships
- [ ] Test critical user journeys
- [ ] Update documentation

### Before Any Deployment
- [ ] All test suites pass
- [ ] Build validation succeeds
- [ ] Environment variables validated
- [ ] Database migrations tested
- [ ] Rollback plan prepared

---

**CRITICAL REMINDER**: These configurations exist because we experienced real production failures. Following these procedures is mandatory, not optional. The testing framework is designed to catch the exact types of failures we discovered in comprehensive analysis.
