#!/usr/bin/env tsx

/**
 * PHASE 2: Documentation Reorganization
 * 
 * This script handles:
 * 1. Categorizing documentation files
 * 2. Creating logical documentation hierarchy
 * 3. Moving files to appropriate locations
 * 4. Creating index files for navigation
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

interface DocCategory {
  name: string;
  directory: string;
  patterns: string[];
  description: string;
}

class Phase2DocumentationReorg {
  private docCategories: DocCategory[] = [
    {
      name: 'API Documentation',
      directory: 'docs/api',
      patterns: ['API_', 'api-', 'endpoint', 'swagger', 'openapi'],
      description: 'API specifications, endpoints, and integration guides'
    },
    {
      name: 'Architecture',
      directory: 'docs/architecture',
      patterns: ['SYSTEM_', 'SERVICE_', 'ARCHITECTURE', 'architecture', 'design'],
      description: 'System architecture, service design, and technical specifications'
    },
    {
      name: 'Deployment',
      directory: 'docs/deployment',
      patterns: ['DEPLOYMENT', 'deployment', 'DOCKER', 'docker', 'STAGING', 'staging', 'PRODUCTION', 'production'],
      description: 'Deployment guides, infrastructure, and operations'
    },
    {
      name: 'Development',
      directory: 'docs/development',
      patterns: ['SETUP', 'setup', 'DEVELOPMENT', 'development', 'CODING', 'coding', 'TYPESCRIPT', 'typescript'],
      description: 'Development setup, coding standards, and guidelines'
    },
    {
      name: 'Testing',
      directory: 'docs/testing',
      patterns: ['TEST', 'test', 'TESTING', 'testing', 'QA', 'qa'],
      description: 'Testing strategies, test results, and quality assurance'
    },
    {
      name: 'Tickets & Summaries',
      directory: 'docs/tickets',
      patterns: ['STAB-', 'TICKET_', 'ticket', 'ADF-', 'INT-', 'H2_', 'H3_', 'SUMMARY', 'summary'],
      description: 'Ticket summaries, implementation reports, and project updates'
    },
    {
      name: 'Operations',
      directory: 'docs/operations',
      patterns: ['OPERATIONS', 'operations', 'MONITORING', 'monitoring', 'RUNBOOK', 'runbook'],
      description: 'Operations guides, monitoring, and maintenance procedures'
    },
    {
      name: 'Business',
      directory: 'docs/business',
      patterns: ['CLIENT_', 'client', 'ONBOARDING', 'onboarding', 'EMAIL_', 'email'],
      description: 'Client guides, onboarding, and business processes'
    }
  ];

  private log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const prefix = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[type];
    console.log(`${prefix} ${message}`);
  }

  private getAllMarkdownFiles(): string[] {
    const files: string[] = [];
    
    // Get files from root
    const rootFiles = fs.readdirSync('.')
      .filter(file => file.endsWith('.md') && file !== 'README.md')
      .map(file => path.join('.', file));
    
    // Get files from docs directory
    const docsFiles: string[] = [];
    if (fs.existsSync('docs')) {
      const walkDir = (dir: string) => {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (item.endsWith('.md')) {
            docsFiles.push(fullPath);
          }
        });
      };
      walkDir('docs');
    }
    
    return [...rootFiles, ...docsFiles];
  }

  private categorizeFile(filePath: string): DocCategory | null {
    const fileName = path.basename(filePath);
    const fileNameUpper = fileName.toUpperCase();
    
    for (const category of this.docCategories) {
      for (const pattern of category.patterns) {
        if (fileNameUpper.includes(pattern.toUpperCase())) {
          return category;
        }
      }
    }
    
    return null;
  }

  private createDirectoryStructure() {
    this.log('Creating documentation directory structure...', 'info');
    
    this.docCategories.forEach(category => {
      if (!fs.existsSync(category.directory)) {
        fs.mkdirSync(category.directory, { recursive: true });
        this.log(`Created directory: ${category.directory}`, 'success');
      }
    });
    
    // Create uncategorized directory for files that don't match patterns
    if (!fs.existsSync('docs/uncategorized')) {
      fs.mkdirSync('docs/uncategorized', { recursive: true });
    }
  }

  private moveFiles() {
    this.log('Categorizing and moving documentation files...', 'info');
    
    const allFiles = this.getAllMarkdownFiles();
    const moveLog: { [category: string]: string[] } = {};
    
    allFiles.forEach(filePath => {
      const category = this.categorizeFile(filePath);
      const fileName = path.basename(filePath);
      
      if (category) {
        const newPath = path.join(category.directory, fileName);
        
        // Avoid moving files that are already in the right place
        if (path.normalize(filePath) !== path.normalize(newPath)) {
          if (!fs.existsSync(newPath)) {
            fs.renameSync(filePath, newPath);
            
            if (!moveLog[category.name]) moveLog[category.name] = [];
            moveLog[category.name].push(fileName);
          }
        }
      } else {
        // Move uncategorized files
        const newPath = path.join('docs/uncategorized', fileName);
        if (path.normalize(filePath) !== path.normalize(newPath) && !fs.existsSync(newPath)) {
          fs.renameSync(filePath, newPath);
          
          if (!moveLog['Uncategorized']) moveLog['Uncategorized'] = [];
          moveLog['Uncategorized'].push(fileName);
        }
      }
    });
    
    // Log the moves
    Object.entries(moveLog).forEach(([category, files]) => {
      this.log(`Moved ${files.length} files to ${category}:`, 'success');
      files.forEach(file => this.log(`  - ${file}`, 'info'));
    });
  }

  private createIndexFiles() {
    this.log('Creating documentation index files...', 'info');
    
    // Create main docs index
    const mainIndexContent = this.generateMainIndex();
    fs.writeFileSync('docs/README.md', mainIndexContent);
    this.log('Created docs/README.md', 'success');
    
    // Create category index files
    this.docCategories.forEach(category => {
      const indexContent = this.generateCategoryIndex(category);
      const indexPath = path.join(category.directory, 'README.md');
      fs.writeFileSync(indexPath, indexContent);
      this.log(`Created ${indexPath}`, 'success');
    });
  }

  private generateMainIndex(): string {
    return `# 📚 Seorylie Documentation

Welcome to the Seorylie project documentation. This directory contains comprehensive documentation organized by category.

## 📁 Documentation Structure

${this.docCategories.map(category => 
  `### [${category.name}](${path.relative('docs', category.directory)}/README.md)
${category.description}
`).join('\n')}

### [Uncategorized](uncategorized/README.md)
Files that don't fit into the above categories

## 🚀 Quick Start

1. **New Developers**: Start with [Development Setup](development/README.md)
2. **Deployment**: See [Deployment Guides](deployment/README.md)
3. **API Integration**: Check [API Documentation](api/README.md)
4. **Architecture**: Review [System Architecture](architecture/README.md)

## 📝 Contributing to Documentation

When adding new documentation:
1. Place files in the appropriate category directory
2. Update the relevant README.md file
3. Follow the established naming conventions
4. Include clear headings and descriptions

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
  }

  private generateCategoryIndex(category: DocCategory): string {
    const files = fs.existsSync(category.directory) 
      ? fs.readdirSync(category.directory)
          .filter(file => file.endsWith('.md') && file !== 'README.md')
          .sort()
      : [];

    return `# ${category.name}

${category.description}

## 📄 Available Documents

${files.length > 0 
  ? files.map(file => `- [${file.replace('.md', '')}](./${file})`).join('\n')
  : '*No documents in this category yet.*'
}

## 📝 Adding Documents

When adding documents to this category, ensure they:
- Follow the naming convention
- Include clear headings and descriptions
- Are relevant to: ${category.description.toLowerCase()}

---

[← Back to Documentation Index](../README.md)
`;
  }

  public async execute() {
    try {
      this.log('🚀 Starting Phase 2: Documentation Reorganization', 'info');
      
      // Step 1: Create directory structure
      this.createDirectoryStructure();
      
      // Step 2: Move and categorize files
      this.moveFiles();
      
      // Step 3: Create index files
      this.createIndexFiles();
      
      this.log('✅ Phase 2 completed successfully!', 'success');
      this.log('📋 Documentation is now organized in docs/ directory', 'info');
      this.log('📋 Next: Run Phase 3 for configuration consolidation', 'info');
      
    } catch (error) {
      this.log(`Phase 2 failed: ${error}`, 'error');
      throw error;
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const reorg = new Phase2DocumentationReorg();
  reorg.execute().catch(console.error);
}

export default Phase2DocumentationReorg;
