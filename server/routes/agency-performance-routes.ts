import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/simpleAuth';
import { supabaseAdmin as supabase } from '../config/supabase';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const router = Router();

// Get performance metrics
router.get('/performance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, package: packageFilter } = req.query;
    const user = (req as any).user;

    // Default to current month if dates not provided
    const start = startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd');

    // Build base query
    let tasksQuery = supabase
      .from('tasks')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end);

    let deliverablesQuery = supabase
      .from('deliverables')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end);

    // Apply package filter if specified
    if (packageFilter && packageFilter !== 'all') {
      tasksQuery = tasksQuery.eq('dealership_package', packageFilter);
    }

    // Execute queries in parallel
    const [
      tasksResult,
      deliverablesResult,
      clientsResult,
      feedbackResult
    ] = await Promise.all([
      tasksQuery,
      deliverablesQuery,
      supabase
        .from('dealerships')
        .select('*')
        .eq('status', 'active'),
      supabase
        .from('client_feedback')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (deliverablesResult.error) throw deliverablesResult.error;
    if (clientsResult.error) throw clientsResult.error;

    const tasks = tasksResult.data || [];
    const deliverables = deliverablesResult.data || [];
    const clients = clientsResult.data || [];
    const feedback = feedbackResult.data || [];

    // Calculate overview metrics
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    // Calculate average completion time (in days)
    const completedTasksWithTime = tasks.filter(t => 
      t.status === 'completed' && t.completed_at && t.created_at
    );
    const avgCompletionTime = completedTasksWithTime.length > 0
      ? completedTasksWithTime.reduce((acc, task) => {
          const created = new Date(task.created_at);
          const completed = new Date(task.completed_at);
          const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          return acc + days;
        }, 0) / completedTasksWithTime.length
      : 0;

    // Calculate client satisfaction
    const avgSatisfaction = feedback.length > 0
      ? feedback.reduce((acc, f) => acc + (f.rating || 0), 0) / feedback.length
      : 4.5; // Default to 4.5 if no feedback

    // Task breakdown by type
    const taskTypes = ['landing_page', 'blog_post', 'gbp_post', 'maintenance'];
    const taskBreakdown = {
      landingPages: {
        total: tasks.filter(t => t.task_type === 'landing_page').length,
        completed: tasks.filter(t => t.task_type === 'landing_page' && t.status === 'completed').length,
        avgTime: calculateAvgTime(tasks.filter(t => t.task_type === 'landing_page'))
      },
      blogPosts: {
        total: tasks.filter(t => t.task_type === 'blog_post').length,
        completed: tasks.filter(t => t.task_type === 'blog_post' && t.status === 'completed').length,
        avgTime: calculateAvgTime(tasks.filter(t => t.task_type === 'blog_post'))
      },
      gbpPosts: {
        total: tasks.filter(t => t.task_type === 'gbp_post').length,
        completed: tasks.filter(t => t.task_type === 'gbp_post' && t.status === 'completed').length,
        avgTime: calculateAvgTime(tasks.filter(t => t.task_type === 'gbp_post'))
      },
      maintenance: {
        total: tasks.filter(t => t.task_type === 'maintenance').length,
        completed: tasks.filter(t => t.task_type === 'maintenance' && t.status === 'completed').length,
        avgTime: calculateAvgTime(tasks.filter(t => t.task_type === 'maintenance'))
      }
    };

    // Monthly trends (last 4 months)
    const monthlyTrends = await getMonthlyTrends();

    // Package performance
    const packagePerformance = await getPackagePerformance(tasks, clients);

    // Client metrics
    const clientMetrics = await getClientMetrics(clients, tasks);

    // Team performance (mock data for now)
    const teamPerformance = [
      { member: 'SEOWerks Team A', tasksCompleted: 45, avgCompletionTime: 2.1, quality: 95, efficiency: 92 },
      { member: 'SEOWerks Team B', tasksCompleted: 38, avgCompletionTime: 2.4, quality: 93, efficiency: 88 },
      { member: 'SEOWerks Team C', tasksCompleted: 41, avgCompletionTime: 2.2, quality: 94, efficiency: 90 }
    ];

    const performanceData = {
      overview: {
        totalTasks: tasks.length,
        completedTasks,
        inProgressTasks,
        completionRate,
        avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
        totalDeliverables: deliverables.length,
        activeClients: clients.length,
        clientSatisfaction: Math.round(avgSatisfaction * 10) / 10
      },
      taskBreakdown,
      monthlyTrends,
      packagePerformance,
      clientMetrics,
      teamPerformance
    };

    res.json(performanceData);
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({
      error: 'Failed to fetch performance data'
    });
  }
});

// Helper function to calculate average completion time
function calculateAvgTime(tasks: any[]): number {
  const completed = tasks.filter(t => t.status === 'completed' && t.completed_at && t.created_at);
  if (completed.length === 0) return 0;

  const totalDays = completed.reduce((acc, task) => {
    const created = new Date(task.created_at);
    const completedDate = new Date(task.completed_at);
    const days = (completedDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return acc + days;
  }, 0);

  return Math.round((totalDays / completed.length) * 10) / 10;
}

// Get monthly trends
async function getMonthlyTrends() {
  const months = [];
  const today = new Date();

  for (let i = 3; i >= 0; i--) {
    const monthStart = startOfMonth(subDays(today, i * 30));
    const monthEnd = endOfMonth(subDays(today, i * 30));

    const { data: monthTasks } = await supabase
      .from('tasks')
      .select('*')
      .gte('created_at', format(monthStart, 'yyyy-MM-dd'))
      .lte('created_at', format(monthEnd, 'yyyy-MM-dd'));

    const { data: monthDeliverables } = await supabase
      .from('deliverables')
      .select('*')
      .gte('created_at', format(monthStart, 'yyyy-MM-dd'))
      .lte('created_at', format(monthEnd, 'yyyy-MM-dd'));

    const completedTasks = monthTasks?.filter(t => t.status === 'completed').length || 0;

    months.push({
      month: format(monthStart, 'MMM'),
      tasks: monthTasks?.length || 0,
      completed: completedTasks,
      deliverables: monthDeliverables?.length || 0,
      satisfaction: 4.5 + (Math.random() * 0.5) // Mock satisfaction trend
    });
  }

  return months;
}

// Get package performance metrics
async function getPackagePerformance(tasks: any[], clients: any[]) {
  const packages = ['PLATINUM', 'GOLD', 'SILVER'];
  const performance = [];

  for (const pkg of packages) {
    const packageClients = clients.filter(c => c.package === pkg);
    const packageTasks = tasks.filter(t => t.dealership_package === pkg);
    const completedTasks = packageTasks.filter(t => t.status === 'completed');

    performance.push({
      package: pkg,
      clients: packageClients.length,
      tasks: packageTasks.length,
      completionRate: packageTasks.length > 0 
        ? Math.round((completedTasks.length / packageTasks.length) * 100)
        : 0,
      revenue: calculatePackageRevenue(pkg, packageClients.length)
    });
  }

  return performance;
}

// Calculate package revenue (mock calculation)
function calculatePackageRevenue(packageType: string, clientCount: number): number {
  const monthlyRates = {
    PLATINUM: 5000,
    GOLD: 3000,
    SILVER: 1500
  };

  return (monthlyRates[packageType as keyof typeof monthlyRates] || 0) * clientCount;
}

// Get client metrics
async function getClientMetrics(clients: any[], tasks: any[]) {
  const metrics = [];

  for (const client of clients.slice(0, 10)) { // Limit to top 10 clients
    const clientTasks = tasks.filter(t => t.dealership_id === client.id);
    const completedTasks = clientTasks.filter(t => t.status === 'completed');
    const pendingTasks = clientTasks.filter(t => t.status !== 'completed');

    // Get last activity
    const lastTask = clientTasks
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
    
    const lastActivity = lastTask 
      ? formatTimeAgo(new Date(lastTask.updated_at))
      : 'No recent activity';

    metrics.push({
      clientName: client.name,
      package: client.package || 'GOLD',
      tasksCompleted: completedTasks.length,
      pendingTasks: pendingTasks.length,
      satisfaction: 4.5 + (Math.random() * 0.5), // Mock satisfaction
      lastActivity
    });
  }

  return metrics;
}

// Format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return format(date, 'MMM d, yyyy');
}

// Export performance report
router.get('/performance/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, format: exportFormat } = req.query;

    // For now, return a simple message
    // TODO: Implement actual CSV/PDF export
    res.json({
      message: 'Export functionality coming soon',
      format: exportFormat || 'csv'
    });
  } catch (error) {
    console.error('Error exporting performance data:', error);
    res.status(500).json({
      error: 'Failed to export performance data'
    });
  }
});

export default router;