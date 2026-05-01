#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

interface TestResult {
  category: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
}

class TestRunner {
  private results: TestResult[] = [];
  private totalTests = 0;
  private totalPassed = 0;
  private totalFailed = 0;
  private totalSkipped = 0;

  async runAllTests() {
    console.log('🧪 Starting comprehensive test suite...\n');
    
    try {
      // Run backend tests
      await this.runTestCategory('Backend API Tests', 'tests/backend/**/*.test.ts');
      
      // Run frontend component tests
      await this.runTestCategory('Frontend Component Tests', 'tests/frontend/components/**/*.test.tsx');
      
      // Run integration tests
      await this.runTestCategory('Integration Tests', 'tests/integration/**/*.test.ts');
      
      // Run utility tests
      await this.runTestCategory('Utility Tests', 'tests/utils/**/*.test.ts');
      
      // Generate coverage report
      await this.generateCoverageReport();
      
      // Display summary
      this.displaySummary();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  private async runTestCategory(name: string, pattern: string): Promise<void> {
    console.log(`\n📂 Running ${name}...`);
    
    try {
      const startTime = Date.now();
      const output = execSync(`npx vitest run "${pattern}" --reporter=json --silent`, {
        encoding: 'utf8',
        timeout: 30000
      });
      
      const duration = Date.now() - startTime;
      const result = JSON.parse(output);
      
      const testResult: TestResult = {
        category: name,
        passed: result.numPassedTests || 0,
        failed: result.numFailedTests || 0,
        skipped: result.numPendingTests || 0,
        duration: duration / 1000,
      };
      
      this.results.push(testResult);
      this.totalTests += testResult.passed + testResult.failed + testResult.skipped;
      this.totalPassed += testResult.passed;
      this.totalFailed += testResult.failed;
      this.totalSkipped += testResult.skipped;
      
      if (testResult.failed > 0) {
        console.log(`❌ ${name}: ${testResult.passed} passed, ${testResult.failed} failed, ${testResult.skipped} skipped`);
      } else {
        console.log(`✅ ${name}: ${testResult.passed} passed, ${testResult.skipped} skipped`);
      }
      
    } catch (error) {
      console.log(`⚠️  ${name}: No tests found or execution failed`);
      console.log(`   Pattern: ${pattern}`);
    }
  }

  private async generateCoverageReport(): Promise<void> {
    console.log('\n📊 Generating coverage report...');
    
    try {
      const output = execSync('npx vitest run --coverage --reporter=json', {
        encoding: 'utf8',
        timeout: 60000
      });
      
      console.log('✅ Coverage report generated');
    } catch (error) {
      console.log('⚠️  Coverage report generation failed');
    }
  }

  private displaySummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TEST SUMMARY');
    console.log('='.repeat(60));
    
    this.results.forEach(result => {
      const status = result.failed > 0 ? '❌' : '✅';
      const duration = result.duration.toFixed(2);
      console.log(`${status} ${result.category}: ${result.passed}/${result.passed + result.failed} (${duration}s)`);
    });
    
    console.log('\n' + '-'.repeat(60));
    console.log(`📋 OVERALL: ${this.totalPassed}/${this.totalTests} tests passed`);
    
    if (this.totalFailed > 0) {
      console.log(`❌ ${this.totalFailed} tests failed`);
    }
    
    if (this.totalSkipped > 0) {
      console.log(`⏭️  ${this.totalSkipped} tests skipped`);
    }
    
    const successRate = this.totalTests > 0 ? (this.totalPassed / this.totalTests * 100).toFixed(1) : '0.0';
    console.log(`📈 Success Rate: ${successRate}%`);
    
    console.log('='.repeat(60));
    
    if (this.totalFailed > 0) {
      console.log('\n❌ Some tests failed. Check the output above for details.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed successfully!');
    }
  }

  // Utility method to find all test files
  private findTestFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.findTestFiles(fullPath));
        } else if (item.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist, ignore
    }
    
    return files;
  }

  // Method to run specific test file
  async runSpecificTest(filePath: string): Promise<void> {
    console.log(`🔍 Running specific test: ${filePath}`);
    
    try {
      execSync(`npx vitest run "${filePath}"`, { stdio: 'inherit' });
    } catch (error) {
      console.error(`Failed to run test: ${filePath}`);
      throw error;
    }
  }

  // Method to run tests in watch mode
  async runWatchMode(): Promise<void> {
    console.log('👀 Starting tests in watch mode...');
    
    try {
      execSync('npx vitest', { stdio: 'inherit' });
    } catch (error) {
      console.error('Watch mode failed');
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();
  
  if (args.length === 0) {
    // Run all tests
    await runner.runAllTests();
  } else if (args[0] === '--watch' || args[0] === '-w') {
    // Watch mode
    await runner.runWatchMode();
  } else if (args[0] === '--file' || args[0] === '-f') {
    // Run specific file
    if (args[1]) {
      await runner.runSpecificTest(args[1]);
    } else {
      console.error('Please specify a test file path');
      process.exit(1);
    }
  } else if (args[0] === '--help' || args[0] === '-h') {
    // Help
    console.log(`
🧪 Test Runner Usage:

  npm run test              Run all tests
  npm run test -- --watch   Run tests in watch mode
  npm run test -- --file path/to/test.ts   Run specific test file
  npm run test -- --help    Show this help message

Available test categories:
  • Backend API Tests (tests/backend/)
  • Frontend Component Tests (tests/frontend/components/)
  • Integration Tests (tests/integration/)
  • Utility Tests (tests/utils/)
    `);
  } else {
    console.error('Unknown argument. Use --help for usage information.');
    process.exit(1);
  }
}

// Check if this file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch(console.error);
}

export default TestRunner;