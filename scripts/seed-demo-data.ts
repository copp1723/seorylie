import { Pool } from 'pg';
import { format, subDays, subHours, addDays } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Please check your .env file.');
  process.exit(1);
}

// Demo dealerships
const dealerships = [
  {
    name: 'AutoMax Dallas',
    package: 'PLATINUM',
    location: 'Dallas, TX',
    website: 'https://automaxdallas.com',
    ga4_property_id: '320759942'
  },
  {
    name: 'Premier Motors',
    package: 'GOLD',
    location: 'Houston, TX',
    website: 'https://premiermotors.com',
    ga4_property_id: '317592148'
  },
  {
    name: 'City Auto Group',
    package: 'SILVER',
    location: 'Austin, TX',
    website: 'https://cityautogroup.com',
    ga4_property_id: '318765432'
  },
  {
    name: 'Luxury Auto Collection',
    package: 'PLATINUM',
    location: 'San Antonio, TX',
    website: 'https://luxuryautocollection.com',
    ga4_property_id: '319876543'
  }
];

// Task templates by type
const taskTemplates = {
  landing_page: [
    {
      title: 'Spring Service Specials Landing Page',
      description: 'Create optimized landing page for spring service promotions',
      metadata: {
        target_keywords: ['auto service specials', 'oil change deals', 'spring car maintenance'],
        target_url: '/service-specials',
        urgency: 'Launch before March 15th'
      }
    },
    {
      title: 'New Model Showcase Page',
      description: 'Landing page for 2024 model lineup with inventory search',
      metadata: {
        target_keywords: ['2024 models', 'new cars', 'latest vehicles'],
        target_url: '/2024-models'
      }
    },
    {
      title: 'Trade-In Value Calculator Page',
      description: 'Interactive page for instant trade-in estimates',
      metadata: {
        target_keywords: ['trade in value', 'sell my car', 'car appraisal'],
        target_url: '/trade-in'
      }
    }
  ],
  blog_post: [
    {
      title: 'Electric Vehicle Maintenance Guide',
      description: 'Comprehensive guide on maintaining electric vehicles',
      metadata: {
        target_keywords: ['EV maintenance', 'electric car service', 'EV care tips'],
        word_count: 1500
      }
    },
    {
      title: 'Winter Driving Safety Tips',
      description: 'Essential safety tips for winter driving conditions',
      metadata: {
        target_keywords: ['winter driving', 'car safety tips', 'cold weather driving'],
        word_count: 1200
      }
    },
    {
      title: 'Understanding Car Financing Options',
      description: 'Guide to auto loans, leasing, and financing',
      metadata: {
        target_keywords: ['car financing', 'auto loans', 'vehicle leasing'],
        word_count: 2000
      }
    }
  ],
  gbp_post: [
    {
      title: 'Customer Spotlight: 5-Star Service Experience',
      description: 'Share recent positive customer testimonial',
      metadata: {
        target_keywords: ['customer review', 'dealership service', '5 star rating']
      }
    },
    {
      title: 'New Inventory Alert: Popular Models Now Available',
      description: 'Announce arrival of high-demand vehicles',
      metadata: {
        target_keywords: ['new inventory', 'cars in stock', 'available now']
      }
    }
  ],
  maintenance: [
    {
      title: 'Monthly SEO Audit and Optimization',
      description: 'Regular SEO health check and improvements',
      metadata: {
        tasks: ['keyword ranking check', 'page speed optimization', 'content updates']
      }
    },
    {
      title: 'Google My Business Profile Update',
      description: 'Update business hours, photos, and respond to reviews',
      metadata: {
        tasks: ['update photos', 'respond to reviews', 'post updates']
      }
    }
  ]
};

// Performance metrics history
const generateMetrics = (dealershipId: string, days: number) => {
  const metrics = [];
  const baseTraffic = Math.floor(Math.random() * 1000) + 500;
  
  for (let i = days; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dayVariation = Math.random() * 0.3 - 0.15; // ±15% variation
    
    metrics.push({
      dealership_id: dealershipId,
      date: format(date, 'yyyy-MM-dd'),
      metrics: {
        sessions: Math.floor(baseTraffic * (1 + dayVariation)),
        users: Math.floor(baseTraffic * 0.8 * (1 + dayVariation)),
        pageviews: Math.floor(baseTraffic * 2.5 * (1 + dayVariation)),
        conversions: Math.floor(baseTraffic * 0.03 * (1 + dayVariation)),
        bounce_rate: 45 + Math.random() * 20,
        avg_session_duration: 120 + Math.random() * 60
      }
    });
  }
  
  return metrics;
};

async function seedDemoData() {
  console.log('🌱 Starting demo data seed...');
  
  try {
    // 1. Create demo dealerships
    console.log('\n📍 Creating dealerships...');
    const dealershipValues = dealerships.map(d => [
      d.name,
      d.package,
      d.location,
      d.website,
      d.ga4_property_id,
      JSON.stringify({
        primary_color: d.package === 'PLATINUM' ? '#8B5CF6' : d.package === 'GOLD' ? '#F59E0B' : '#6B7280',
        logo_url: `/logos/${d.name.toLowerCase().replace(/\s+/g, '-')}.png`
      })
    ]);

    const dealershipQuery = `
      INSERT INTO dealerships (name, package_type, location, website, ga4_property_id, settings)
      VALUES ${dealershipValues.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ')}
      RETURNING *
    `;

    const { rows: createdDealerships } = await pool.query(dealershipQuery, dealershipValues.flat());
    console.log(`✅ Created ${createdDealerships.length} dealerships`);
    
    // 2. Create tasks for each dealership
    console.log('\n📋 Creating tasks...');
    const allTasks = [];
    
    for (const dealership of createdDealerships) {
      // Determine number of tasks based on package
      const taskCount = dealership.package_type === 'PLATINUM' ? 8 : 
                       dealership.package_type === 'GOLD' ? 6 : 4;
      
      // Mix of task types
      const taskTypes = ['landing_page', 'blog_post', 'gbp_post', 'maintenance'];
      
      for (let i = 0; i < taskCount; i++) {
        const taskType = taskTypes[i % taskTypes.length];
        const templates = taskTemplates[taskType as keyof typeof taskTemplates];
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        // Vary task status for realistic demo
        const statuses = ['requested', 'in_progress', 'review', 'completed'];
        const statusWeights = [0.2, 0.3, 0.2, 0.3]; // 20% requested, 30% in progress, etc.
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        const task = {
          dealership_id: dealership.id,
          dealership_name: dealership.name,
          dealership_package: dealership.package_type,
          task_type: taskType,
          title: template.title,
          description: template.description,
          status: randomStatus,
          priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
          created_at: subDays(new Date(), Math.floor(Math.random() * 30)).toISOString(),
          updated_at: subHours(new Date(), Math.floor(Math.random() * 48)).toISOString(),
          metadata: template.metadata
        };
        
        // Add completed_at for completed tasks
        if (task.status === 'completed') {
          task.completed_at = subHours(new Date(), Math.floor(Math.random() * 24)).toISOString();
        }
        
        allTasks.push(task);
      }
    }
    
    // Insert tasks using PostgreSQL
    if (allTasks.length > 0) {
      const taskValues = allTasks.map(t => [
        t.dealership_id,
        t.dealership_name,
        t.dealership_package,
        t.task_type,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at,
        JSON.stringify(t.metadata),
        t.completed_at || null
      ]);

      const taskQuery = `
        INSERT INTO seo_tasks (
          dealership_id, dealership_name, dealership_package, task_type,
          title, description, status, priority, created_at, updated_at,
          metadata, completed_at
        )
        VALUES ${taskValues.map((_, i) => 
          `($${i * 12 + 1}, $${i * 12 + 2}, $${i * 12 + 3}, $${i * 12 + 4}, $${i * 12 + 5}, $${i * 12 + 6}, $${i * 12 + 7}, $${i * 12 + 8}, $${i * 12 + 9}, $${i * 12 + 10}, $${i * 12 + 11}, $${i * 12 + 12})`
        ).join(', ')}
        RETURNING *
      `;

      const { rows: createdTasks } = await pool.query(taskQuery, taskValues.flat());
      console.log(`✅ Created ${createdTasks.length} tasks`);
    
      // 3. Add deliverables to completed tasks
      console.log('\n📎 Creating deliverables...');
      const deliverables = [];
      
      for (const task of createdTasks.filter(t => t.status === 'completed' || t.status === 'review')) {
        const deliverableCount = task.task_type === 'landing_page' ? 2 : 1;
        
        for (let i = 0; i < deliverableCount; i++) {
          deliverables.push({
            task_id: task.id,
            file_url: `/deliverables/${task.id}-${i + 1}.${task.task_type === 'landing_page' ? 'html' : 'docx'}`,
            file_type: task.task_type === 'landing_page' ? 'html' : 'document',
            file_size: Math.floor(Math.random() * 500000) + 50000,
            created_at: task.completed_at || task.updated_at
          });
        }
      }
      
      if (deliverables.length > 0) {
        const deliverableValues = deliverables.map(d => [
          d.task_id,
          d.file_url,
          d.file_type,
          d.file_size,
          d.created_at
        ]);

        const deliverableQuery = `
          INSERT INTO deliverables (task_id, file_url, file_type, file_size, created_at)
          VALUES ${deliverableValues.map((_, i) => 
            `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
          ).join(', ')}
        `;

        await pool.query(deliverableQuery, deliverableValues.flat());
        console.log(`✅ Created ${deliverables.length} deliverables`);
      }
    } else {
      console.log('✅ Created 0 tasks');
    }
    
    // 4. Generate performance metrics
    console.log('\n📊 Generating performance metrics...');
    const allMetrics = [];
    
    for (const dealership of createdDealerships) {
      const metrics = generateMetrics(dealership.id, 30); // 30 days of data
      allMetrics.push(...metrics);
    }
    
    if (allMetrics.length > 0) {
      const metricValues = allMetrics.map(m => [
        m.dealership_id,
        m.date,
        JSON.stringify(m.metrics)
      ]);

      const metricQuery = `
        INSERT INTO performance_metrics (dealership_id, date, metrics)
        VALUES ${metricValues.map((_, i) => 
          `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`
        ).join(', ')}
      `;

      await pool.query(metricQuery, metricValues.flat());
      console.log(`✅ Created ${allMetrics.length} performance metric entries`);
    }
    
    // 5. Create sample reports
    console.log('\n📑 Creating sample reports...');
    const reports = [];
    
    for (const dealership of createdDealerships) {
      reports.push({
        dealership_id: dealership.id,
        type: 'monthly_performance',
        title: `${dealership.name} - March 2024 Performance Report`,
        status: 'ready',
        file_url: `/reports/${dealership.id}-march-2024.pdf`,
        date_range: {
          start: '2024-03-01',
          end: '2024-03-31'
        },
        created_at: subDays(new Date(), 5).toISOString()
      });
    }
    
    if (reports.length > 0) {
      const reportValues = reports.map(r => [
        r.dealership_id,
        r.type,
        r.title,
        r.status,
        r.file_url,
        JSON.stringify(r.date_range),
        r.created_at
      ]);

      const reportQuery = `
        INSERT INTO reports (dealership_id, type, title, status, file_url, date_range, created_at)
        VALUES ${reportValues.map((_, i) => 
          `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
        ).join(', ')}
      `;

      await pool.query(reportQuery, reportValues.flat());
      console.log(`✅ Created ${reports.length} reports`);
    }
    
    // 6. Create demo users
    console.log('\n👥 Creating demo users...');
    const demoUsers = [
      {
        email: 'demo@seowerks.com',
        password: 'demo123',
        role: 'agency_admin',
        name: 'Demo Admin'
      },
      {
        email: 'team@seowerks.com',
        password: 'demo123',
        role: 'agency_team',
        name: 'Demo Team Member'
      },
      {
        email: 'dealer@automaxdallas.com',
        password: 'demo123',
        role: 'dealership_admin',
        name: 'John Smith',
        dealership_id: createdDealerships[0].id
      }
    ];
    
    // Note: In production, use proper auth flow. This is for demo only.
    console.log('\n✅ Demo users ready:');
    console.log('- Agency Admin: demo@seowerks.com / demo123');
    console.log('- Team Member: team@seowerks.com / demo123');
    console.log('- Dealership: dealer@automaxdallas.com / demo123');
    
    console.log('\n🎉 Demo data seeding complete!');
    console.log('\n📋 Summary:');
    console.log(`- ${createdDealerships.length} dealerships`);
    console.log(`- ${allTasks.length} tasks`);
    console.log(`- ${deliverables.length} deliverables`);
    console.log(`- ${allMetrics.length} metric entries`);
    console.log(`- ${reports.length} reports`);
    console.log('\n🚀 Your demo is ready!');
    
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seeder
seedDemoData().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
});