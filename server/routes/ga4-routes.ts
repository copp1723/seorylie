import { Router, Request, Response } from 'express';
import { ga4Service } from '../services/ga4Service';
import { authenticateToken } from '../middleware/simpleAuth';

const router = Router();

// Get analytics data
router.get('/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate } = req.query;

    if (!propertyId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters: propertyId, startDate, endDate'
      });
    }

    // Validate property ID
    const validProperties = ['320759942', '317592148'];
    if (!validProperties.includes(propertyId as string)) {
      return res.status(400).json({
        error: 'Invalid property ID'
      });
    }

    // Fetch analytics data
    const analyticsData = await ga4Service.getAnalyticsData({
      propertyId: propertyId as string,
      startDate: startDate as string,
      endDate: endDate as string
    });

    res.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics data'
    });
  }
});

// Verify property access
router.get('/verify-property/:propertyId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    
    const hasAccess = await ga4Service.verifyPropertyAccess(propertyId);
    
    res.json({
      propertyId,
      hasAccess,
      propertyName: hasAccess ? `Property ${propertyId}` : null
    });
  } catch (error) {
    console.error('Error verifying property access:', error);
    res.status(500).json({
      error: 'Failed to verify property access'
    });
  }
});

// Get specific metric data
router.get('/metrics/:metric', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { metric } = req.params;
    const { propertyId, startDate, endDate } = req.query;

    if (!propertyId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    const params = {
      propertyId: propertyId as string,
      startDate: startDate as string,
      endDate: endDate as string
    };

    let data;
    switch (metric) {
      case 'daily':
        data = await ga4Service.getDailyMetrics(params);
        break;
      case 'pages':
        data = await ga4Service.getTopPages(params);
        break;
      case 'sources':
        data = await ga4Service.getTrafficSources(params);
        break;
      case 'search':
        data = await ga4Service.getSearchQueries(params);
        break;
      default:
        return res.status(400).json({ error: 'Invalid metric type' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching metric data:', error);
    res.status(500).json({
      error: 'Failed to fetch metric data'
    });
  }
});

// Export analytics data as CSV
router.get('/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate, format } = req.query;

    if (!propertyId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    const analyticsData = await ga4Service.getAnalyticsData({
      propertyId: propertyId as string,
      startDate: startDate as string,
      endDate: endDate as string
    });

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(analyticsData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${startDate}-${endDate}.csv`);
      res.send(csv);
    } else {
      // Default to JSON
      res.json(analyticsData);
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      error: 'Failed to export analytics data'
    });
  }
});

// Helper function to convert data to CSV
function convertToCSV(data: any): string {
  const { summary, dailyMetrics } = data;
  
  let csv = 'Analytics Summary\n';
  csv += 'Metric,Value\n';
  csv += `Sessions,${summary.sessions}\n`;
  csv += `Users,${summary.users}\n`;
  csv += `Page Views,${summary.pageviews}\n`;
  csv += `Avg Session Duration,${summary.avgSessionDuration}\n`;
  csv += `Bounce Rate,${summary.bounceRate}%\n`;
  csv += `Conversions,${summary.conversions}\n`;
  csv += '\n';
  
  csv += 'Daily Metrics\n';
  csv += 'Date,Sessions,Users,Page Views,Conversions\n';
  
  dailyMetrics.forEach((day: any) => {
    csv += `${day.date},${day.sessions},${day.users},${day.pageviews},${day.conversions}\n`;
  });
  
  return csv;
}

export default router;