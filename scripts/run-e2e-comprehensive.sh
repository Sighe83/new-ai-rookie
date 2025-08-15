#!/bin/bash

# Comprehensive End-to-End Test Runner
# Executes all E2E test suites and generates comprehensive report

set -e  # Exit on any error

echo "🚀 COMPREHENSIVE END-TO-END TEST EXECUTION"
echo "=========================================="
echo ""

# Load environment variables from .env.test if it exists
if [ -f ".env.test" ]; then
    echo "📁 Loading environment variables from .env.test..."
    export $(cat .env.test | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
    echo ""
fi

# Check if required environment variables are set
echo "🔍 Checking environment setup..."

REQUIRED_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_PUBLISHABLE_KEY"
    "STRIPE_WEBHOOK_SECRET"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '%s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please set these variables before running the tests."
    exit 1
fi

echo "✅ Environment variables validated"
echo ""

# Check if development server is running (for local testing)
if [ "$NODE_ENV" != "production" ]; then
    echo "🔍 Checking if development server is running..."
    
    if curl -s -f http://localhost:3000 > /dev/null; then
        echo "✅ Development server is running"
    else
        echo "⚠️  Development server not detected at localhost:3000"
        echo "   If testing locally, please start the development server first:"
        echo "   npm run dev"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    echo ""
fi

# Set test environment
export NODE_ENV="${NODE_ENV:-test}"
export TEST_TIMEOUT="${TEST_TIMEOUT:-3600000}"  # 1 hour default timeout

echo "📊 Test Configuration:"
echo "   Environment: $NODE_ENV"
echo "   Timeout: $TEST_TIMEOUT ms"
echo "   Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Create test results directory
mkdir -p test-results/e2e

echo "🧪 Starting comprehensive test execution..."
echo ""

# Track start time
START_TIME=$(date +%s)

# Initialize test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
SUITE_FAILURES=()

# Function to run a test suite
run_test_suite() {
    local suite_name="$1"
    local test_file="$2"
    local description="$3"
    
    echo "📋 Executing: $suite_name"
    echo "📝 Description: $description"
    echo "📁 File: $test_file"
    echo ""
    
    # Run the test suite and capture results
    local suite_start=$(date +%s)
    local output_file="test-results/e2e/${suite_name// /-}.json"
    
    if vitest run "tests/e2e/$test_file" --reporter=json --outputFile="$output_file" --testTimeout="$TEST_TIMEOUT"; then
        local suite_end=$(date +%s)
        local suite_duration=$((suite_end - suite_start))
        
        echo "✅ $suite_name completed in ${suite_duration}s"
        
        # Parse results if JSON output is available
        if [ -f "$output_file" ]; then
            local suite_passed=$(jq -r '.testResults[0].numPassingTests // 0' "$output_file" 2>/dev/null || echo "0")
            local suite_failed=$(jq -r '.testResults[0].numFailingTests // 0' "$output_file" 2>/dev/null || echo "0")
            local suite_skipped=$(jq -r '.testResults[0].numPendingTests // 0' "$output_file" 2>/dev/null || echo "0")
            
            TOTAL_TESTS=$((TOTAL_TESTS + suite_passed + suite_failed + suite_skipped))
            PASSED_TESTS=$((PASSED_TESTS + suite_passed))
            FAILED_TESTS=$((FAILED_TESTS + suite_failed))
            SKIPPED_TESTS=$((SKIPPED_TESTS + suite_skipped))
            
            echo "📊 Results: $suite_passed passed, $suite_failed failed, $suite_skipped skipped"
        fi
    else
        echo "❌ $suite_name failed"
        SUITE_FAILURES+=("$suite_name")
    fi
    
    echo ""
}

# Execute all test suites
echo "🎯 Executing test suites..."
echo ""

run_test_suite "API Endpoints Validation" "api-endpoints-validation.test.ts" "Comprehensive validation of all API endpoints"

run_test_suite "Complete Booking Flow" "booking-flow-complete.test.ts" "End-to-end booking workflow testing"

run_test_suite "User Journey Integration" "user-journey-integration.test.ts" "Real-world user scenario testing"

run_test_suite "Error Scenarios Comprehensive" "error-scenarios-comprehensive.test.ts" "Failure paths and error recovery"

run_test_suite "Security Validation" "security-validation-comprehensive.test.ts" "Security testing and vulnerability assessment"

run_test_suite "Performance Baselines" "performance-baseline-comprehensive.test.ts" "Performance testing and baseline establishment"

# Execute comprehensive reporting
echo "📊 Generating comprehensive test report..."
echo ""

if vitest run "tests/e2e/test-execution-report.ts" --reporter=verbose --testTimeout="$TEST_TIMEOUT"; then
    echo "✅ Comprehensive report generated"
else
    echo "⚠️  Report generation encountered issues"
fi

# Calculate final results
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))
SUCCESS_RATE=0

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
fi

echo ""
echo "🎯 COMPREHENSIVE TEST EXECUTION COMPLETE"
echo "========================================"
echo ""
echo "📊 FINAL RESULTS:"
echo "   Total Tests: $TOTAL_TESTS"
echo "   Passed: $PASSED_TESTS"
echo "   Failed: $FAILED_TESTS"
echo "   Skipped: $SKIPPED_TESTS"
echo "   Success Rate: $SUCCESS_RATE%"
echo "   Total Duration: ${TOTAL_DURATION}s ($(($TOTAL_DURATION / 60))m $(($TOTAL_DURATION % 60))s)"
echo ""

if [ ${#SUITE_FAILURES[@]} -gt 0 ]; then
    echo "❌ FAILED SUITES:"
    printf '   - %s\n' "${SUITE_FAILURES[@]}"
    echo ""
fi

# Determine overall result
if [ $FAILED_TESTS -eq 0 ] && [ ${#SUITE_FAILURES[@]} -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION!"
    echo ""
    
    # Check if comprehensive report exists
    if [ -f "E2E_TEST_EXECUTION_REPORT.md" ]; then
        echo "📄 Comprehensive report: E2E_TEST_EXECUTION_REPORT.md"
        echo "📊 JSON results: e2e-test-results.json"
    fi
    
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Review the comprehensive test report"
    echo "   2. Set up production monitoring based on recommendations"
    echo "   3. Configure alerts and dashboards"
    echo "   4. Proceed with production deployment"
    
    exit 0
else
    echo "⚠️  SOME TESTS FAILED - REVIEW REQUIRED BEFORE PRODUCTION"
    echo ""
    echo "🔍 Investigation Steps:"
    echo "   1. Review failed test details in test-results/e2e/"
    echo "   2. Check E2E_TEST_EXECUTION_REPORT.md for analysis"
    echo "   3. Address critical issues and blockers"
    echo "   4. Re-run tests after fixes"
    
    exit 1
fi