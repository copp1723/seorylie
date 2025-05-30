import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ScatterChart, Scatter
} from 'recharts';
import { 
  Card, Grid, Typography, Box, Tabs, Tab, Paper, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, 
  TableRow, Chip, Button, CircularProgress, LinearProgress,
  Select, MenuItem, FormControl, InputLabel, TextField, IconButton,
  Tooltip as MuiTooltip, Avatar, List, ListItem, ListItemText, ListItemAvatar
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Speed as SpeedIcon,
  BugReport as BugReportIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import HeatMap from 'react-heatmap-grid';

// Types
interface IntegrationTicket {
  id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  assignee: string;
  dependencies: string[];
  startDate?: string;
  completionDate?: string;
  risk: 'High' | 'Medium' | 'Low';
  effort: number;
  progress: number;
  conflicts: number;
  testsPassing: number;
  testsTotal: number;
  branch: string;
  emoji: '🟢' | '🟡' | '🔴';
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  ticketsCompleted: number;
  conflictsResolved: number;
  velocity: number;
}

interface KnownIssue {
  id: string;
  title: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved';
  assignee: string;
  createdDate: string;
  resolvedDate?: string;
  relatedTickets: string[];
  description: string;
}

interface PerformanceMetric {
  name: string;
  before: number;
  after: number;
  unit: string;
  improvement: number;
}

interface QualityGate {
  name: string;
  status: 'Passed' | 'Failed' | 'Pending';
  threshold: number;
  actual: number;
  unit: string;
}

interface DailyProgress {
  date: string;
  ticketsCompleted: number;
  conflictsResolved: number;
  testsAdded: number;
  velocity: number;
}

interface ConflictData {
  ticketA: string;
  ticketB: string;
  conflictCount: number;
  resolvedCount: number;
  files: string[];
}

// Mock data generator functions
const generateMockTickets = (): IntegrationTicket[] => {
  const tickets: IntegrationTicket[] = [
    {
      id: 'INT-002',
      title: 'C3 Database Connection Pool Integration',
      priority: 'High',
      status: 'Completed',
      assignee: 'Josh Copp',
      dependencies: ['INT-001'],
      startDate: '2025-05-15',
      completionDate: '2025-05-16',
      risk: 'Medium',
      effort: 4,
      progress: 100,
      conflicts: 0,
      testsPassing: 42,
      testsTotal: 42,
      branch: 'C3-database-connection-pool',
      emoji: '🟡'
    },
    {
      id: 'INT-004',
      title: 'C5 Global Error Handling',
      priority: 'High',
      status: 'Completed',
      assignee: 'Josh Copp',
      dependencies: ['INT-002'],
      startDate: '2025-05-17',
      completionDate: '2025-05-18',
      risk: 'Medium',
      effort: 4,
      progress: 100,
      conflicts: 0,
      testsPassing: 38,
      testsTotal: 38,
      branch: 'C5-global-error-handling',
      emoji: '🟡'
    },
    {
      id: 'INT-006',
      title: 'H6 KPI Query Caching',
      priority: 'High',
      status: 'Completed',
      assignee: 'Josh Copp',
      dependencies: ['INT-002', 'INT-003'],
      startDate: '2025-05-19',
      completionDate: '2025-05-20',
      risk: 'Low',
      effort: 3,
      progress: 100,
      conflicts: 0,
      testsPassing: 35,
      testsTotal: 35,
      branch: 'H6-kpi-query-caching',
      emoji: '🟢'
    },
    {
      id: 'INT-008',
      title: 'Integrate Observability Features (I1, I2, I3)',
      priority: 'Medium',
      status: 'Completed',
      assignee: 'Josh Copp',
      dependencies: ['INT-004'],
      startDate: '2025-05-21',
      completionDate: '2025-05-22',
      risk: 'Low',
      effort: 5,
      progress: 100,
      conflicts: 0,
      testsPassing: 45,
      testsTotal: 45,
      branch: 'multiple-branches',
      emoji: '🟢'
    },
    {
      id: 'INT-010',
      title: 'Integrate UI Loading States (U1)',
      priority: 'High',
      status: 'Completed',
      assignee: 'Josh Copp',
      dependencies: ['INT-007'],
      startDate: '2025-05-23',
      completionDate: '2025-05-24',
      risk: 'Low',
      effort: 4,
      progress: 100,
      conflicts: 0,
      testsPassing: 52,
      testsTotal: 52,
      branch: 'U1-ui-loading-states',
      emoji: '🟢'
    },
    {
      id: 'INT-012',
      title: 'Integrate Power User Features (U3, U4)',
      priority: 'Medium',
      status: 'Completed',
      assignee: 'Josh Copp',
      dependencies: ['INT-010'],
      startDate: '2025-05-25',
      completionDate: '2025-05-26',
      risk: 'Low',
      effort: 5,
      progress: 100,
      conflicts: 0,
      testsPassing: 25,
      testsTotal: 25,
      branch: 'multiple-branches',
      emoji: '🟢'
    },
    {
      id: 'INT-014',
      title: 'Migration & Deployment Preparation',
      priority: 'High',
      status: 'Completed',
      assignee: 'Josh Copp',
      dependencies: ['INT-013'],
      startDate: '2025-05-27',
      completionDate: '2025-05-28',
      risk: 'Medium',
      effort: 4,
      progress: 100,
      conflicts: 0,
      testsPassing: 15,
      testsTotal: 15,
      branch: 'integration/production-readiness-phase1',
      emoji: '🔴'
    },
    {
      id: 'INT-016',
      title: 'Create Integration Dashboard',
      priority: 'Medium',
      status: 'In Progress',
      assignee: 'Josh Copp',
      dependencies: ['INT-001'],
      startDate: '2025-05-29',
      risk: 'Low',
      effort: 3,
      progress: 75,
      conflicts: 0,
      testsPassing: 8,
      testsTotal: 10,
      branch: 'integration-dashboard-feature',
      emoji: '🟢'
    }
  ];
  
  return tickets;
};

const generateMockTeamMembers = (): TeamMember[] => {
  return [
    {
      id: 'josh',
      name: 'Josh Copp',
      role: 'Lead Developer',
      avatar: '/avatars/josh.png',
      ticketsCompleted: 7,
      conflictsResolved: 12,
      velocity: 1.75
    },
    {
      id: 'sarah',
      name: 'Sarah Chen',
      role: 'Backend Developer',
      avatar: '/avatars/sarah.png',
      ticketsCompleted: 5,
      conflictsResolved: 8,
      velocity: 1.25
    },
    {
      id: 'miguel',
      name: 'Miguel Rodriguez',
      role: 'Frontend Developer',
      avatar: '/avatars/miguel.png',
      ticketsCompleted: 4,
      conflictsResolved: 5,
      velocity: 1.0
    }
  ];
};

const generateMockIssues = (): KnownIssue[] => {
  return [
    {
      id: 'ISSUE-001',
      title: 'Database connection pool timeout under high load',
      priority: 'High',
      status: 'Resolved',
      assignee: 'Josh Copp',
      createdDate: '2025-05-16',
      resolvedDate: '2025-05-17',
      relatedTickets: ['INT-002'],
      description: 'Connection pool timeout occurs when load exceeds 500 RPS. Fixed by increasing max connections to 20.'
    },
    {
      id: 'ISSUE-002',
      title: 'Trace IDs missing from some 500 responses',
      priority: 'Medium',
      status: 'Resolved',
      assignee: 'Sarah Chen',
      createdDate: '2025-05-18',
      resolvedDate: '2025-05-19',
      relatedTickets: ['INT-004'],
      description: 'Some error responses were missing trace IDs due to middleware ordering. Fixed by ensuring error handler runs last.'
    },
    {
      id: 'ISSUE-003',
      title: 'KPI cache not invalidating on ETL events',
      priority: 'High',
      status: 'Resolved',
      assignee: 'Josh Copp',
      createdDate: '2025-05-20',
      resolvedDate: '2025-05-21',
      relatedTickets: ['INT-006'],
      description: 'Cache invalidation was not triggering on ETL events. Fixed by adding Redis pub/sub channel.'
    },
    {
      id: 'ISSUE-004',
      title: 'Command palette search performance degrades with many items',
      priority: 'Medium',
      status: 'In Progress',
      assignee: 'Miguel Rodriguez',
      createdDate: '2025-05-26',
      relatedTickets: ['INT-012'],
      description: 'Search performance slows down with >500 commands. Implementing indexed search with worker thread.'
    },
    {
      id: 'ISSUE-005',
      title: 'Integration dashboard missing some metrics',
      priority: 'Low',
      status: 'Open',
      assignee: 'Josh Copp',
      createdDate: '2025-05-29',
      relatedTickets: ['INT-016'],
      description: 'Some metrics are not displaying correctly on the integration dashboard. Need to fix data sources.'
    }
  ];
};

const generateMockPerformanceMetrics = (): PerformanceMetric[] => {
  return [
    {
      name: 'KPI Dashboard Response',
      before: 310,
      after: 42,
      unit: 'ms',
      improvement: 7.4
    },
    {
      name: 'API Response Time',
      before: 220,
      after: 140,
      unit: 'ms',
      improvement: 1.57
    },
    {
      name: 'WebSocket Recovery',
      before: 5000,
      after: 950,
      unit: 'ms',
      improvement: 5.26
    },
    {
      name: 'Command Palette Search',
      before: 0,
      after: 3.7,
      unit: 'ms',
      improvement: 0
    },
    {
      name: 'Bulk Operations (100 agents)',
      before: 0,
      after: 27,
      unit: 'ms',
      improvement: 0
    }
  ];
};

const generateMockQualityGates = (): QualityGate[] => {
  return [
    {
      name: 'Unit Test Coverage',
      status: 'Passed',
      threshold: 80,
      actual: 83,
      unit: '%'
    },
    {
      name: 'Integration Test Pass Rate',
      status: 'Passed',
      threshold: 95,
      actual: 100,
      unit: '%'
    },
    {
      name: 'E2E Test Pass Rate',
      status: 'Passed',
      threshold: 90,
      actual: 96,
      unit: '%'
    },
    {
      name: 'Load Test Error Rate',
      status: 'Passed',
      threshold: 1,
      actual: 0.3,
      unit: '%'
    },
    {
      name: 'Security Scan (Critical)',
      status: 'Passed',
      threshold: 0,
      actual: 0,
      unit: 'issues'
    }
  ];
};

const generateMockDailyProgress = (): DailyProgress[] => {
  return [
    { date: '2025-05-15', ticketsCompleted: 0, conflictsResolved: 2, testsAdded: 8, velocity: 0.5 },
    { date: '2025-05-16', ticketsCompleted: 1, conflictsResolved: 3, testsAdded: 12, velocity: 1.0 },
    { date: '2025-05-17', ticketsCompleted: 0, conflictsResolved: 1, testsAdded: 5, velocity: 0.5 },
    { date: '2025-05-18', ticketsCompleted: 1, conflictsResolved: 2, testsAdded: 10, velocity: 1.0 },
    { date: '2025-05-19', ticketsCompleted: 0, conflictsResolved: 2, testsAdded: 7, velocity: 0.5 },
    { date: '2025-05-20', ticketsCompleted: 1, conflictsResolved: 1, testsAdded: 9, velocity: 1.0 },
    { date: '2025-05-21', ticketsCompleted: 0, conflictsResolved: 3, testsAdded: 15, velocity: 0.5 },
    { date: '2025-05-22', ticketsCompleted: 1, conflictsResolved: 2, testsAdded: 8, velocity: 1.0 },
    { date: '2025-05-23', ticketsCompleted: 0, conflictsResolved: 1, testsAdded: 12, velocity: 0.5 },
    { date: '2025-05-24', ticketsCompleted: 1, conflictsResolved: 0, testsAdded: 14, velocity: 1.0 },
    { date: '2025-05-25', ticketsCompleted: 0, conflictsResolved: 2, testsAdded: 5, velocity: 0.5 },
    { date: '2025-05-26', ticketsCompleted: 1, conflictsResolved: 1, testsAdded: 8, velocity: 1.0 },
    { date: '2025-05-27', ticketsCompleted: 0, conflictsResolved: 0, testsAdded: 3, velocity: 0.5 },
    { date: '2025-05-28', ticketsCompleted: 1, conflictsResolved: 0, testsAdded: 6, velocity: 1.0 },
    { date: '2025-05-29', ticketsCompleted: 0, conflictsResolved: 0, testsAdded: 8, velocity: 0.5 }
  ];
};

const generateMockConflictData = (): ConflictData[] => {
  return [
    { ticketA: 'INT-002', ticketB: 'INT-004', conflictCount: 3, resolvedCount: 3, files: ['server/db.ts', 'server/index.ts', 'server/utils/error-handler.ts'] },
    { ticketA: 'INT-004', ticketB: 'INT-006', conflictCount: 2, resolvedCount: 2, files: ['server/utils/error-handler.ts', 'server/services/monitoring.ts'] },
    { ticketA: 'INT-006', ticketB: 'INT-008', conflictCount: 1, resolvedCount: 1, files: ['server/routes.ts'] },
    { ticketA: 'INT-008', ticketB: 'INT-010', conflictCount: 0, resolvedCount: 0, files: [] },
    { ticketA: 'INT-010', ticketB: 'INT-012', conflictCount: 2, resolvedCount: 2, files: ['client/src/utils/lazy-loading.tsx', 'client/src/contexts/LoadingContext.tsx'] },
    { ticketA: 'INT-012', ticketB: 'INT-014', conflictCount: 0, resolvedCount: 0, files: [] },
    { ticketA: 'INT-014', ticketB: 'INT-016', conflictCount: 0, resolvedCount: 0, files: [] }
  ];
};

// Generate conflict heat map data
const generateConflictHeatMapData = () => {
  const tickets = generateMockTickets();
  const ticketIds = tickets.map(t => t.id);
  const xLabels = ticketIds;
  const yLabels = ticketIds;
  
  // Initialize with zeros
  const data = Array(yLabels.length)
    .fill(0)
    .map(() => Array(xLabels.length).fill(0));
  
  // Fill in conflict data
  const conflicts = generateMockConflictData();
  conflicts.forEach(conflict => {
    const ticketAIndex = ticketIds.indexOf(conflict.ticketA);
    const ticketBIndex = ticketIds.indexOf(conflict.ticketB);
    if (ticketAIndex >= 0 && ticketBIndex >= 0) {
      data[ticketAIndex][ticketBIndex] = conflict.conflictCount;
      data[ticketBIndex][ticketAIndex] = conflict.conflictCount;
    }
  });
  
  return { data, xLabels, yLabels };
};

// Main Dashboard Component
const IntegrationTrackingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  // Load mock data
  const tickets = useMemo(() => generateMockTickets(), []);
  const teamMembers = useMemo(() => generateMockTeamMembers(), []);
  const issues = useMemo(() => generateMockIssues(), []);
  const performanceMetrics = useMemo(() => generateMockPerformanceMetrics(), []);
  const qualityGates = useMemo(() => generateMockQualityGates(), []);
  const dailyProgress = useMemo(() => generateMockDailyProgress(), []);
  const conflictData = useMemo(() => generateMockConflictData(), []);
  const heatMapData = useMemo(() => generateConflictHeatMapData(), []);
  
  // Calculate summary metrics
  const totalTickets = tickets.length;
  const completedTickets = tickets.filter(t => t.status === 'Completed').length;
  const inProgressTickets = tickets.filter(t => t.status === 'In Progress').length;
  const notStartedTickets = tickets.filter(t => t.status === 'Not Started').length;
  const blockedTickets = tickets.filter(t => t.status === 'Blocked').length;
  
  const completionPercentage = Math.round((completedTickets / totalTickets) * 100);
  
  const totalConflicts = conflictData.reduce((sum, item) => sum + item.conflictCount, 0);
  const resolvedConflicts = conflictData.reduce((sum, item) => sum + item.resolvedCount, 0);
  
  const totalTests = tickets.reduce((sum, ticket) => sum + ticket.testsTotal, 0);
  const passingTests = tickets.reduce((sum, ticket) => sum + ticket.testsPassing, 0);
  const testPassRate = Math.round((passingTests / totalTests) * 100);
  
  const avgVelocity = teamMembers.reduce((sum, member) => sum + member.velocity, 0) / teamMembers.length;
  
  // Simulate refresh
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Dashboard Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
          <DashboardIcon sx={{ mr: 1 }} /> Integration Sprint Dashboard
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <MuiTooltip title="Last updated: May 29, 2025 10:45 AM">
            <Typography variant="caption" sx={{ mr: 2 }}>
              {refreshing ? 'Refreshing...' : 'Live data'}
            </Typography>
          </MuiTooltip>
          
          <MuiTooltip title="Dashboard settings">
            <IconButton size="small" sx={{ mx: 0.5 }}>
              <SettingsIcon />
            </IconButton>
          </MuiTooltip>
          
          <MuiTooltip title="Refresh data">
            <IconButton 
              color="primary" 
              onClick={handleRefresh} 
              disabled={refreshing}
              sx={{ ml: 1 }}
            >
              {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  Completion Progress
                </Typography>
                <Typography variant="h4" color="textPrimary">
                  {completionPercentage}%
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'success.main' }}>
                <AssessmentIcon />
              </Avatar>
            </Box>
            <Box sx={{ px: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={completionPercentage} 
                color="success"
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Box sx={{ p: 2, pt: 1 }}>
              <Typography variant="caption" sx={{ display: 'block' }}>
                {completedTickets} of {totalTickets} tickets completed
              </Typography>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  Conflict Resolution
                </Typography>
                <Typography variant="h4" color="textPrimary">
                  {resolvedConflicts}/{totalConflicts}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'warning.main' }}>
                <CodeIcon />
              </Avatar>
            </Box>
            <Box sx={{ px: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={totalConflicts > 0 ? (resolvedConflicts / totalConflicts) * 100 : 100} 
                color="warning"
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Box sx={{ p: 2, pt: 1 }}>
              <Typography variant="caption" sx={{ display: 'block' }}>
                {totalConflicts > 0 ? 
                  `${Math.round((resolvedConflicts / totalConflicts) * 100)}% conflicts resolved` : 
                  'No conflicts detected'}
              </Typography>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  Test Coverage
                </Typography>
                <Typography variant="h4" color="textPrimary">
                  {testPassRate}%
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'info.main' }}>
                <BugReportIcon />
              </Avatar>
            </Box>
            <Box sx={{ px: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={testPassRate} 
                color="info"
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Box sx={{ p: 2, pt: 1 }}>
              <Typography variant="caption" sx={{ display: 'block' }}>
                {passingTests} of {totalTests} tests passing
              </Typography>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  Team Velocity
                </Typography>
                <Typography variant="h4" color="textPrimary">
                  {avgVelocity.toFixed(2)}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <SpeedIcon />
              </Avatar>
            </Box>
            <Box sx={{ px: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={Math.min((avgVelocity / 2) * 100, 100)} 
                color="primary"
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Box sx={{ p: 2, pt: 1 }}>
              <Typography variant="caption" sx={{ display: 'block' }}>
                Tickets per day (target: 2.0)
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>
      
      {/* Dashboard Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" icon={<DashboardIcon />} iconPosition="start" />
          <Tab label="Tickets" icon={<AssignmentIcon />} iconPosition="start" />
          <Tab label="Team" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Performance" icon={<SpeedIcon />} iconPosition="start" />
          <Tab label="Quality" icon={<CheckCircleIcon />} iconPosition="start" />
        </Tabs>
      </Paper>
      
      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {/* Overview Tab */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            {/* Sprint Progress */}
            <Grid item xs={12} md={8}>
              <Card>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Sprint Progress</Typography>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select defaultValue="2-week" size="small">
                      <MenuItem value="1-week">Last 7 days</MenuItem>
                      <MenuItem value="2-week">Last 14 days</MenuItem>
                      <MenuItem value="sprint">Current Sprint</MenuItem>
                      <MenuItem value="all">All Time</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Divider />
                <Box sx={{ height: 300, p: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dailyProgress}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="ticketsCompleted" stackId="1" stroke="#8884d8" fill="#8884d8" name="Tickets Completed" />
                      <Area type="monotone" dataKey="conflictsResolved" stackId="2" stroke="#ffc658" fill="#ffc658" name="Conflicts Resolved" />
                      <Area type="monotone" dataKey="testsAdded" stackId="3" stroke="#82ca9d" fill="#82ca9d" name="Tests Added" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>
            
            {/* Ticket Status */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Ticket Status</Typography>
                </Box>
                <Divider />
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Completed', value: completedTickets, color: '#4caf50' },
                          { name: 'In Progress', value: inProgressTickets, color: '#2196f3' },
                          { name: 'Not Started', value: notStartedTickets, color: '#9e9e9e' },
                          { name: 'Blocked', value: blockedTickets, color: '#f44336' }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {[
                          { name: 'Completed', value: completedTickets, color: '#4caf50' },
                          { name: 'In Progress', value: inProgressTickets, color: '#2196f3' },
                          { name: 'Not Started', value: notStartedTickets, color: '#9e9e9e' },
                          { name: 'Blocked', value: blockedTickets, color: '#f44336' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>
            
            {/* Recent Activity */}
            <Grid item xs={12} md={6}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Recent Activity</Typography>
                </Box>
                <Divider />
                <List sx={{ p: 0 }}>
                  <ListItem divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'success.main' }}>
                        <CheckCircleIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="INT-014 Migration & Deployment Preparation completed" 
                      secondary="May 28, 2025 - 4:32 PM" 
                    />
                  </ListItem>
                  <ListItem divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'info.main' }}>
                        <AssignmentIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="INT-016 Create Integration Dashboard started" 
                      secondary="May 29, 2025 - 9:15 AM" 
                    />
                  </ListItem>
                  <ListItem divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'warning.main' }}>
                        <BugReportIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="ISSUE-005 reported: Integration dashboard missing metrics" 
                      secondary="May 29, 2025 - 10:22 AM" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'success.main' }}>
                        <CheckCircleIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="All quality gates passed for v1.0-rc1" 
                      secondary="May 28, 2025 - 6:03 PM" 
                    />
                  </ListItem>
                </List>
              </Card>
            </Grid>
            
            {/* Quality Gate Summary */}
            <Grid item xs={12} md={6}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Quality Gate Summary</Typography>
                </Box>
                <Divider />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Gate</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actual</TableCell>
                        <TableCell align="right">Threshold</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {qualityGates.map((gate) => (
                        <TableRow key={gate.name}>
                          <TableCell>{gate.name}</TableCell>
                          <TableCell>
                            <Chip 
                              size="small"
                              label={gate.status} 
                              color={gate.status === 'Passed' ? 'success' : gate.status === 'Failed' ? 'error' : 'warning'} 
                            />
                          </TableCell>
                          <TableCell align="right">{gate.actual}{gate.unit}</TableCell>
                          <TableCell align="right">{gate.status === 'Failed' ? '>' : '<'}{gate.threshold}{gate.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* Tickets Tab */}
        {activeTab === 1 && (
          <Card>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Integration Tickets</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControl size="small" sx={{ width: 120, mr: 1 }}>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" defaultValue="all" size="small">
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="in-progress">In Progress</MenuItem>
                    <MenuItem value="not-started">Not Started</MenuItem>
                    <MenuItem value="blocked">Blocked</MenuItem>
                  </Select>
                </FormControl>
                <TextField 
                  size="small" 
                  placeholder="Search tickets..." 
                  variant="outlined"
                  InputProps={{
                    startAdornment: <FilterListIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Box>
            </Box>
            <Divider />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Assignee</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Branch</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>{ticket.id}</TableCell>
                      <TableCell>{ticket.title}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={ticket.priority} 
                          color={
                            ticket.priority === 'High' ? 'error' : 
                            ticket.priority === 'Medium' ? 'warning' : 
                            'success'
                          } 
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={ticket.status} 
                          color={
                            ticket.status === 'Completed' ? 'success' : 
                            ticket.status === 'Blocked' ? 'error' : 
                            ticket.status === 'In Progress' ? 'primary' : 
                            'default'
                          } 
                        />
                      </TableCell>
                      <TableCell>{ticket.assignee}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={ticket.risk} 
                          color={
                            ticket.risk === 'High' ? 'error' : 
                            ticket.risk === 'Medium' ? 'warning' : 
                            'success'
                          } 
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={ticket.progress} 
                              color={
                                ticket.progress === 100 ? 'success' : 
                                ticket.progress > 50 ? 'primary' : 
                                'warning'
                              }
                              sx={{ height: 8, borderRadius: 5 }}
                            />
                          </Box>
                          <Box sx={{ minWidth: 35 }}>
                            <Typography variant="body2" color="textSecondary">{`${ticket.progress}%`}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={ticket.branch} 
                          variant="outlined"
                          icon={<CodeIcon fontSize="small" />}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}
        
        {/* Team Tab */}
        {activeTab === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Team Performance</Typography>
                </Box>
                <Divider />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Team Member</TableCell>
                        <TableCell align="right">Tickets Completed</TableCell>
                        <TableCell align="right">Conflicts Resolved</TableCell>
                        <TableCell align="right">Velocity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar src={member.avatar} sx={{ mr: 2, width: 32, height: 32 }} />
                              <Box>
                                <Typography variant="body2">{member.name}</Typography>
                                <Typography variant="caption" color="textSecondary">{member.role}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="right">{member.ticketsCompleted}</TableCell>
                          <TableCell align="right">{member.conflictsResolved}</TableCell>
                          <TableCell align="right">{member.velocity.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Team Velocity Trend</Typography>
                </Box>
                <Divider />
                <Box sx={{ height: 300, p: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyProgress}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="velocity" stroke="#8884d8" name="Team Velocity" />
                      <Line type="monotone" dataKey="ticketsCompleted" stroke="#82ca9d" name="Tickets Completed" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* Performance Tab */}
        {activeTab === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Performance Improvements</Typography>
                </Box>
                <Divider />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Metric</TableCell>
                        <TableCell align="right">Before</TableCell>
                        <TableCell align="right">After</TableCell>
                        <TableCell align="right">Unit</TableCell>
                        <TableCell align="right">Improvement</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {performanceMetrics.map((metric) => (
                        <TableRow key={metric.name}>
                          <TableCell>{metric.name}</TableCell>
                          <TableCell align="right">{metric.before}</TableCell>
                          <TableCell align="right">{metric.after}</TableCell>
                          <TableCell align="right">{metric.unit}</TableCell>
                          <TableCell align="right">
                            {metric.improvement > 0 ? 
                              (metric.unit === 'ms' || metric.unit === 's' ? 
                                `${metric.improvement.toFixed(1)}× faster` : 
                                `${metric.improvement.toFixed(1)}× better`) : 
                              'N/A'}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small"
                              label={metric.improvement > 1 ? 'Improved' : metric.improvement === 0 ? 'New' : 'Degraded'} 
                              color={metric.improvement > 1 ? 'success' : metric.improvement === 0 ? 'primary' : 'error'} 
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Performance Comparison</Typography>
                </Box>
                <Divider />
                <Box sx={{ height: 400, p: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={performanceMetrics.filter(m => m.unit === 'ms')}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="before" name="Before (ms)" fill="#ff9800" />
                      <Bar dataKey="after" name="After (ms)" fill="#4caf50" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* Quality Tab */}
        {activeTab === 4 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Quality Gates</Typography>
                </Box>
                <Divider />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Gate</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actual</TableCell>
                        <TableCell align="right">Threshold</TableCell>
                        <TableCell>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {qualityGates.map((gate) => (
                        <TableRow key={gate.name}>
                          <TableCell>{gate.name}</TableCell>
                          <TableCell>
                            <Chip 
                              size="small"
                              label={gate.status} 
                              color={gate.status === 'Passed' ? 'success' : gate.status === 'Failed' ? 'error' : 'warning'} 
                            />
                          </TableCell>
                          <TableCell align="right">{gate.actual}{gate.unit}</TableCell>
                          <TableCell align="right">{gate.status === 'Failed' ? '>' : '<'}{gate.threshold}{gate.unit}</TableCell>
                          <TableCell>
                            <Button size="small" variant="outlined">View Details</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Card>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">Test Coverage by Component</Typography>
                </Box>
                <Divider />
                <Box sx={{ height: 300, p: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Database Layer', coverage: 92 },
                        { name: 'API Routes', coverage: 87 },
                        { name: 'Error Handling', coverage: 95 },
                        { name: 'Caching', coverage: 78 },
                        { name: 'WebSockets', coverage: 72 },
                        { name: 'UI Components', coverage: 68 },
                        { name: 'Authentication', coverage: 89 }
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="coverage" name="Coverage (%)" fill="#4caf50">
                        {[
                          { name: 'Database Layer', coverage: 92 },
                          { name: 'API Routes', coverage: 87 },
                          { name: 'Error Handling', coverage: 95 },
                          { name: 'Caching', coverage: 78 },
                          { name: 'WebSockets', coverage: 72 },
                          { name: 'UI Components', coverage: 68 },
                          { name: 'Authentication', coverage: 89 }
                        ].map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.coverage >= 80 ? '#4caf50' : entry.coverage >= 70 ? '#ff9800' : '#f44336'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </Box>
  );
};

export default IntegrationTrackingDashboard;
