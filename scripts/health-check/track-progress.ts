#!/usr/bin/env node
/**
 * Health Check Progress Tracker
 * Shows the current status of health check improvements
 */

import * as fs from 'fs';
import * as path from 'path';

interface HealthCheckTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  priority: 'critical' | 'high' | 'medium' | 'low';
  week: 1 | 2 | 3;
  script?: string;
  dependencies?: string[];
  notes?: string;
}

const tasks: HealthCheckTask[] = [
  // Week 1 - Critical Fixes
  {
    id: 'consolidate-servers',
    name: 'Consolidate Server Entry Points',
    description: 'Merge 7 server files into 1 unified server',
    status: 'pending',
    priority: 'critical',
    week: 1,
    script: 'npm run health:consolidate-servers',
    notes: 'Reduces confusion and maintenance overhead'
  },
  {
    id: 'consolidate-auth',
    name: 'Consolidate Authentication',
    description: 'Unify 7 auth implementations into 1 system',
    status: 'pending',
    priority: 'critical',
    week: 1,
    script: 'npm run health:consolidate-auth',
    notes: 'Improves security and consistency'
  },
  {
    id: 'fix-async',
    name: 'Fix Async/Await Patterns',
    description: 'Auto-fix 50+ async anti-patterns',
    status: 'pending',
    priority: 'high',
    week: 1,
    script: 'npm run health:fix-async',
    notes: 'Prevents race conditions and improves error handling'
  },
  {
    id: 'consolidate-email',
    name: 'Consolidate Email Services',
    description: 'Merge 4 email services into 1 unified service',
    status: 'pending',
    priority: 'high',
    week: 1,
    script: 'npm run health:consolidate-email',
    notes: 'Centralizes email functionality'
  },
  
  // Week 2 - Structural Improvements
  {
    id: 'implement-security',
    name: 'Implement Security Patterns',
    description: 'Add security middleware and best practices',
    status: 'pending',
    priority: 'high',
    week: 2,
    script: 'npm run health:security',
    dependencies: ['consolidate-auth'],
    notes: 'Adds CSRF, rate limiting, input validation'
  },
  {
    id: 'modular-architecture',
    name: 'Generate Modular Architecture',
    description: 'Create dependency injection and module structure',
    status: 'pending',
    priority: 'medium',
    week: 2,
    script: 'npm run health:modular',
    dependencies: ['consolidate-servers'],
    notes: 'Improves testability and maintainability'
  },
  {
    id: 'refactor-large-files',
    name: 'Refactor Large Files',
    description: 'Break down 12 files >500 lines',
    status: 'pending',
    priority: 'medium',
    week: 2,
    script: 'npm run health:refactor-orchestrator',
    notes: 'Starting with orchestrator.ts (2433 lines)'
  },
  
  // Week 3 - Optimization
  {
    id: 'reorganize-files',
    name: 'Reorganize File Structure',
    description: 'Move 20+ root files to proper directories',
    status: 'pending',
    priority: 'low',
    week: 3,
    script: 'npm run health:reorganize',
    dependencies: ['consolidate-servers', 'modular-architecture'],
    notes: 'Creates clean project structure'
  },
  {
    id: 'remove-duplicates',
    name: 'Remove Duplicate Files',
    description: 'Delete 15+ duplicate files after consolidation',
    status: 'pending',
    priority: 'low',
    week: 3,
    dependencies: ['consolidate-servers', 'consolidate-auth', 'consolidate-email'],
    notes: 'Final cleanup after consolidation'
  }
];

// Progress calculation
function calculateProgress(): {
  total: number;
  completed: number;
  inProgress: number;
  percentage: number;
  byWeek: Record<number, { total: number; completed: number }>;
} {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  
  const byWeek = {
    1: { total: 0, completed: 0 },
    2: { total: 0, completed: 0 },
    3: { total: 0, completed: 0 }
  };
  
  tasks.forEach(task => {
    byWeek[task.week].total++;
    if (task.status === 'completed') {
      byWeek[task.week].completed++;
    }
  });
  
  return {
    total: tasks.length,
    completed,
    inProgress,
    percentage: Math.round((completed / tasks.length) * 100),
    byWeek
  };
}

// Display functions
function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✅';
    case 'in-progress': return '🔄';
    case 'blocked': return '🚫';
    default: return '⏳';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return '\x1b[31m'; // Red
    case 'high': return '\x1b[33m'; // Yellow
    case 'medium': return '\x1b[36m'; // Cyan
    case 'low': return '\x1b[37m'; // White
    default: return '\x1b[0m';
  }
}

// Main display
console.clear();
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║                   SEORYLIE HEALTH CHECK PROGRESS                 ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

const progress = calculateProgress();

// Overall progress bar
const progressBar = '█'.repeat(Math.floor(progress.percentage / 5)) + 
                   '░'.repeat(20 - Math.floor(progress.percentage / 5));
console.log(`Overall Progress: [${progressBar}] ${progress.percentage}%`);
console.log(`Tasks: ${progress.completed}/${progress.total} completed, ${progress.inProgress} in progress\n`);

// Week-by-week breakdown
for (let week = 1; week <= 3; week++) {
  const weekProgress = progress.byWeek[week as 1 | 2 | 3];
  const weekPercentage = weekProgress.total > 0 
    ? Math.round((weekProgress.completed / weekProgress.total) * 100) 
    : 0;
    
  console.log(`\n📅 WEEK ${week} - ${weekPercentage}% Complete`);
  console.log('─'.repeat(68));
  
  const weekTasks = tasks.filter(t => t.week === week);
  weekTasks.forEach(task => {
    const icon = getStatusIcon(task.status);
    const priorityColor = getPriorityColor(task.priority);
    const resetColor = '\x1b[0m';
    
    console.log(`${icon} ${priorityColor}[${task.priority.toUpperCase()}]${resetColor} ${task.name}`);
    console.log(`   ${task.description}`);
    
    if (task.status === 'pending' && task.script) {
      console.log(`   📝 Run: ${task.script}`);
    }
    
    if (task.dependencies && task.dependencies.length > 0) {
      const blockers = task.dependencies.filter(dep => 
        tasks.find(t => t.id === dep)?.status !== 'completed'
      );
      if (blockers.length > 0) {
        console.log(`   ⚠️  Blocked by: ${blockers.join(', ')}`);
      }
    }
    
    if (task.notes) {
      console.log(`   💡 ${task.notes}`);
    }
    console.log('');
  });
}

// Next actions
console.log('\n🎯 NEXT ACTIONS');
console.log('─'.repeat(68));

const nextTasks = tasks
  .filter(t => t.status === 'pending' && t.script)
  .filter(t => !t.dependencies || t.dependencies.every(dep => 
    tasks.find(task => task.id === dep)?.status === 'completed'
  ))
  .slice(0, 3);

if (nextTasks.length > 0) {
  nextTasks.forEach((task, index) => {
    console.log(`${index + 1}. ${task.name}`);
    console.log(`   ${task.script}`);
  });
} else {
  console.log('No unblocked tasks available. Complete in-progress tasks first.');
}

// Summary statistics
console.log('\n📊 STATISTICS');
console.log('─'.repeat(68));
console.log(`• Duplicate files to remove: 15+`);
console.log(`• Large files to refactor: 12`);
console.log(`• Async patterns to fix: 50+`);
console.log(`• Security vulnerabilities: 8`);
console.log(`• Estimated effort remaining: ${(9 - progress.completed) * 10} hours`);

// Save progress report
const report = {
  timestamp: new Date().toISOString(),
  progress,
  tasks,
  nextActions: nextTasks.map(t => ({ name: t.name, command: t.script }))
};

fs.writeFileSync('HEALTH_CHECK_PROGRESS.json', JSON.stringify(report, null, 2));
console.log('\n💾 Progress saved to HEALTH_CHECK_PROGRESS.json');

console.log('\n✨ Run specific health check commands or use:');
console.log('   ./scripts/health-check/quick-actions.sh');
console.log('   for an interactive menu\n');