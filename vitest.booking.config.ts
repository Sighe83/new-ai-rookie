import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { loadEnv } from 'vite'

/**
 * Vitest configuration specifically for booking system tests
 * 
 * This configuration is optimized for comprehensive testing of the
 * booking and payment system with proper timeouts, coverage, and
 * environment setup.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    
    // Load test environment variables
    env: loadEnv('test', process.cwd(), ''),
    
    // Timeouts - increased for integration tests
    testTimeout: 30000,  // 30 seconds for integration tests
    hookTimeout: 10000,  // 10 seconds for setup/teardown
    
    // Test file patterns
    include: [
      'tests/api-integration/**/*.test.ts',
      'tests/api-integration/**/*.test.tsx'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      
      // Include patterns
      include: [
        'app/api/**/*.ts',
        'lib/**/*.ts',
        'supabase/migrations/**/*.sql'
      ],
      
      // Exclude patterns
      exclude: [
        'node_modules/**',
        'tests/**',
        'stories/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-*'
      ],
      
      // Coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 90,
          statements: 90
        },
        // Critical booking system files
        'app/api/bookings/**/*.ts': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'app/api/payment/**/*.ts': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'app/api/webhooks/**/*.ts': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    
    // Reporters
    reporters: [
      'default',
      'json'
    ],
    
    // Output files
    outputFile: {
      json: './test-results/results.json'
    },
    
    // Retry configuration for flaky tests
    retry: 2,
    
    // Pool configuration for parallel testing
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
        useAtomics: true
      }
    },
    
    // Sequence configuration
    sequence: {
      hooks: 'parallel',
      concurrent: true
    },
    
    // Watch mode configuration
    watch: false,
    
    // Reporter configuration
    silent: false,
    
    // Benchmark configuration
    benchmark: {
      outputFile: './test-results/benchmark.json',
      reporters: ['json', 'default']
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  
  // Define constants for tests
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.VITEST': 'true'
  }
})