// Mock database module for development without PostgreSQL
// This simulates the database for alpha testing

const mockData = {
  users: [
    {
      id: 1,
      dealership_id: 'alpha-test-001',
      email: 'demo@alphatestford.com',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJRdIoWC', // demo123
      first_name: 'Demo',
      last_name: 'User',
      role: 'admin'
    }
  ],
  dealerships: [
    {
      id: 'alpha-test-001',
      name: 'Alpha Test Ford',
      settings: {
        package: 'GOLD',
        main_brand: 'Ford',
        target_cities: ['Springfield', 'Shelbyville'],
        target_vehicle_models: ['F-150', 'Mustang', 'Explorer']
      }
    }
  ],
  seoworks_tasks: [
    {
      id: 1,
      dealership_id: 'alpha-test-001',
      external_id: 'task-001',
      task_type: 'blog_post',
      status: 'completed',
      data: { title: 'Top 5 Features of the 2024 Ford F-150', published_url: 'https://alphatestford.com/blog/2024-f150-features' }
    },
    {
      id: 2,
      dealership_id: 'alpha-test-001',
      external_id: 'task-002',
      task_type: 'blog_post',
      status: 'completed',
      data: { title: 'Why the Ford Mustang is Perfect for Summer', published_url: 'https://alphatestford.com/blog/mustang-summer-driving' }
    },
    {
      id: 3,
      dealership_id: 'alpha-test-001',
      external_id: 'task-003',
      task_type: 'landing_page',
      status: 'in_progress',
      data: { title: 'Ford Explorer Special Offers', target_keywords: ['Ford Explorer deals', 'Explorer specials Springfield'] }
    }
  ],
  chat_conversations: [],
  chat_messages: [],
  seo_requests: []
};

// Mock Pool class that simulates pg.Pool
class MockPool {
  constructor(config) {
    this.config = config;
    this._connected = true;
  }

  async query(sql, params = []) {
    console.log('Mock DB Query:', sql.substring(0, 50) + '...');
    
    // Handle specific queries
    if (sql.includes('SELECT NOW()')) {
      return { rows: [{ current_time: new Date().toISOString() }] };
    }
    
    if (sql.includes('SELECT u.*, d.name as dealership_name FROM users')) {
      const email = params[0];
      const user = mockData.users.find(u => u.email === email);
      if (user) {
        const dealership = mockData.dealerships.find(d => d.id === user.dealership_id);
        return { 
          rows: [{
            ...user,
            dealership_name: dealership ? dealership.name : null
          }]
        };
      }
      return { rows: [] };
    }
    
    if (sql.includes('SELECT * FROM dealerships WHERE id =')) {
      const dealership = mockData.dealerships.find(d => d.id === params[0]);
      return { rows: dealership ? [dealership] : [] };
    }
    
    if (sql.includes('SELECT * FROM seoworks_tasks')) {
      const dealershipId = params[0];
      const tasks = mockData.seoworks_tasks.filter(t => t.dealership_id === dealershipId);
      return { rows: tasks };
    }
    
    if (sql.includes('INSERT INTO chat_conversations')) {
      const [id, dealership_id, user_id] = params;
      const conversation = { id, dealership_id, user_id, status: 'active' };
      mockData.chat_conversations.push(conversation);
      return { rows: [conversation] };
    }
    
    if (sql.includes('INSERT INTO chat_messages')) {
      const [id, conversation_id, message_type, content] = params;
      const message = { id, conversation_id, message_type, content, created_at: new Date() };
      mockData.chat_messages.push(message);
      return { rows: [message] };
    }
    
    if (sql.includes('INSERT INTO seo_requests')) {
      const request = {
        id: params[0],
        dealership_id: params[1],
        user_id: params[2],
        request_type: params[3],
        priority: params[4],
        description: params[5],
        additional_context: params[6],
        status: 'pending',
        created_at: new Date()
      };
      mockData.seo_requests.push(request);
      return { rows: [request] };
    }
    
    // Default response
    return { rows: [], rowCount: 0 };
  }
  
  async end() {
    console.log('Mock database connection closed');
  }
}

module.exports = { Pool: MockPool };