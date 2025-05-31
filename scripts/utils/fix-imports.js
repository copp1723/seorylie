#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to fix imports in a file
function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix .js imports to remove .js extension
    const jsImportRegex = /from\s+['"]([^'"]+)\.js['"]/g;
    if (jsImportRegex.test(content)) {
      content = content.replace(jsImportRegex, "from '$1'");
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
}

// Get all TypeScript files that need fixing
const filesToFix = [
  'server/middleware/auth.ts',
  'server/routes/agent-squad-routes.ts',
  'server/services/hybrid-ai-service.ts',
  'server/services/agentSquad/inventory-functions.ts',
  'server/services/agentSquad/orchestrator.ts',
  'server/services/agentSquad/rylie-retriever.ts',
  'server/services/agentSquad/advanced-routing.ts',
  'server/services/agentSquad/index.ts',
  'server/services/inventory-functions.ts',
  'server/services/orchestrator.ts',
  'server/services/advanced-routing.ts',
  'server/services/index.ts'
];

console.log('Fixing import paths...');
filesToFix.forEach(fixImportsInFile);
console.log('Import fixes complete!');
