#!/usr/bin/env tsx
/**
 * Script to optimize lucide-react imports by converting them to individual icon imports
 * This reduces bundle size significantly as lucide-react is 28MB when importing all icons
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const ICON_IMPORT_REGEX = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]lucide-react['"]/g;
const INDIVIDUAL_ICON_REGEX = /([A-Z][a-zA-Z]+)(?:Icon)?/g;

async function optimizeLucideImports() {
  console.log('🔍 Searching for files with lucide-react imports...');
  
  // Find all TypeScript/JavaScript files that might contain lucide imports
  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
    cwd: process.cwd()
  });

  let totalFilesProcessed = 0;
  let totalIconsOptimized = 0;

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    const content = await fs.readFile(filePath, 'utf-8');
    
    if (!content.includes('lucide-react')) {
      continue;
    }

    let updatedContent = content;
    let fileModified = false;

    // Find all lucide-react imports
    const matches = [...content.matchAll(ICON_IMPORT_REGEX)];
    
    for (const match of matches) {
      const importedIcons = match[1]
        .split(',')
        .map(icon => icon.trim())
        .filter(Boolean);

      if (importedIcons.length === 0) continue;

      // Generate individual imports
      const individualImports = importedIcons
        .map(iconName => {
          // Ensure the icon name ends with Icon if it doesn't already
          const normalizedName = iconName.endsWith('Icon') ? iconName : `${iconName}Icon`;
          return `import { ${normalizedName} } from 'lucide-react/dist/esm/icons/${iconName.toLowerCase().replace(/icon$/i, '')}';`;
        })
        .join('\n');

      // Replace the grouped import with individual imports
      updatedContent = updatedContent.replace(match[0], individualImports);
      fileModified = true;
      totalIconsOptimized += importedIcons.length;
    }

    if (fileModified) {
      await fs.writeFile(filePath, updatedContent, 'utf-8');
      console.log(`✅ Optimized ${file}`);
      totalFilesProcessed++;
    }
  }

  console.log(`\n🎉 Optimization complete!`);
  console.log(`   Files processed: ${totalFilesProcessed}`);
  console.log(`   Icons optimized: ${totalIconsOptimized}`);
  console.log(`\n💡 Note: You may need to update your imports if any icons were renamed.`);
  console.log(`   Run 'npm run build' to verify all imports are working correctly.`);
}

// Run the optimization
optimizeLucideImports().catch(console.error);