/**
 * DEPRECATED: This script has been replaced by validate-environment.ts
 *
 * Please use the new comprehensive validation script instead:
 *   npx tsx scripts/validate-environment.ts
 *
 * This file is kept for backward compatibility but will be removed in a future version.
 */

import chalk from 'chalk';

console.log(chalk.yellow.bold('⚠️  DEPRECATION NOTICE'));
console.log(chalk.yellow('This script has been replaced by validate-environment.ts'));
console.log(chalk.yellow('Please use: npx tsx scripts/validate-environment.ts\n'));

// Import and run the new validator
import { EnvironmentValidator } from './validate-environment';

const validator = new EnvironmentValidator();



// Run the new validator instead
validator.runAll()
  .then(() => {
    console.log(chalk.blue('\n📋 Migration Guide:'));
    console.log('• Update your scripts to use: npx tsx scripts/validate-environment.ts');
    console.log('• This file will be removed in a future version');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during environment validation:', error);
    process.exit(1);
  });