import { v4 as uuidv4 } from 'uuid';

describe('Agent Studio', () => {
  // Test data
  const agentName = `Test Agent ${uuidv4().slice(0, 8)}`;
  const agentPrompt = 'You are a helpful assistant that analyzes data and provides insights.';
  const sandboxName = `Test Sandbox ${uuidv4().slice(0, 8)}`;
  
  // Mock data for API responses
  const mockSandbox = {
    id: 1,
    name: sandboxName,
    description: 'Test sandbox for Cypress',
    token_limit_per_hour: 10000,
    token_limit_per_day: 50000,
    current_hourly_usage: 0,
    current_daily_usage: 0,
    is_active: true
  };
  
  const mockTools = [
    {
      id: 1,
      name: 'watchdog_analysis',
      service: 'analytics',
      description: 'Analyze data using Watchdog analytics engine',
      category: 'Analytics',
      is_active: true
    },
    {
      id: 2,
      name: 'vin_agent_task',
      service: 'automation',
      description: 'Execute automation tasks using VIN Agent',
      category: 'Automation',
      is_active: true
    }
  ];
  
  const mockSession = {
    sandboxId: 1,
    sessionId: `sess_${uuidv4()}`,
    websocketChannel: '/ws/sandbox/1/sess_test123'
  };
  
  const mockInsights = [
    {
      id: 'insight-1',
      title: 'Sales Performance Analysis',
      description: 'Analysis of sales performance for the last quarter',
      score: 0.85,
      metrics: {
        total_sales: 1250000,
        growth_rate: 0.12,
        top_performer: 'John Doe'
      }
    }
  ];
  
  beforeEach(() => {
    // Login mock - set the auth token
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', 'test-token');
      win.localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test User', role: 'admin' }));
    });
    
    // Stub the API calls
    cy.intercept('GET', '/api/tools', {
      statusCode: 200,
      body: { success: true, tools: mockTools }
    }).as('getTools');
    
    cy.intercept('GET', '/api/sandboxes', {
      statusCode: 200,
      body: { success: true, sandboxes: [] }
    }).as('getSandboxes');
    
    cy.intercept('POST', '/api/sandboxes', {
      statusCode: 201,
      body: { success: true, sandbox: mockSandbox }
    }).as('createSandbox');
    
    cy.intercept('POST', '/api/sandboxes/1/sessions', {
      statusCode: 201,
      body: { success: true, session: mockSession }
    }).as('createSession');
    
    // Mock WebSocket
    cy.window().then((win) => {
      // Create a mock WebSocket class
      class MockWebSocket extends EventTarget {
        url: string;
        readyState: number = WebSocket.CONNECTING;
        
        constructor(url: string) {
          super();
          this.url = url;
          
          // Simulate connection after a short delay
          setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            this.dispatchEvent(new Event('open'));
          }, 100);
        }
        
        send(data: string) {
          const parsedData = JSON.parse(data);
          
          // Simulate responses based on message type
          if (parsedData.type === 'connect') {
            this.mockResponse({
              type: 'connect',
              success: true,
              sessionId: mockSession.sessionId
            });
          } else if (parsedData.type === 'agent_message') {
            this.mockResponse({
              type: 'agent_response',
              content: 'Processing your request...',
              timestamp: new Date().toISOString()
            });
          } else if (parsedData.type === 'tool_request' && parsedData.toolName === 'watchdog_analysis') {
            // First send a tool stream start event
            this.mockResponse({
              type: 'tool_stream',
              toolName: 'watchdog_analysis',
              streamEvent: {
                type: 'start',
                timestamp: new Date().toISOString()
              }
            });
            
            // Then send data after a short delay
            setTimeout(() => {
              this.mockResponse({
                type: 'tool_stream',
                toolName: 'watchdog_analysis',
                streamEvent: {
                  type: 'data',
                  data: {
                    insights: mockInsights
                  },
                  timestamp: new Date().toISOString()
                }
              });
            }, 500);
            
            // Finally send completion event
            setTimeout(() => {
              this.mockResponse({
                type: 'tool_stream',
                toolName: 'watchdog_analysis',
                streamEvent: {
                  type: 'end',
                  timestamp: new Date().toISOString()
                }
              });
            }, 1000);
          }
        }
        
        close() {
          this.readyState = WebSocket.CLOSED;
          this.dispatchEvent(new Event('close'));
        }
        
        // Helper to dispatch message events
        mockResponse(data: any) {
          const event = new MessageEvent('message', {
            data: JSON.stringify(data)
          });
          this.dispatchEvent(event);
        }
      }
      
      // Replace the WebSocket constructor
      win.WebSocket = MockWebSocket as any;
    });
    
    // Visit the Agent Studio page
    cy.visit('/agent-studio');
  });
  
  it('should complete the Agent Studio happy path flow', () => {
    // 1. Verify navigation to Agent Studio
    cy.get('h1').should('contain', 'Agent Studio');
    cy.wait('@getTools');
    cy.wait('@getSandboxes');
    
    // 2. Create a new sandbox
    cy.contains('button', 'Create New Sandbox').click();
    cy.wait('@createSandbox');
    cy.get('#sandboxSelect').should('contain', sandboxName);
    
    // 3. Define agent name and prompt
    cy.get('#agentName').clear().type(agentName);
    cy.get('#agentPrompt').clear().type(agentPrompt);
    
    // 4. Toggle the watchdog_analysis tool
    cy.contains('watchdog_analysis')
      .parent()
      .within(() => {
        cy.get('input[type="checkbox"]').check();
      });
    
    // Verify tool is selected
    cy.contains('Selected tools').should('contain', 'watchdog_analysis');
    
    // 5. Click Run and verify real-time logs
    cy.contains('button', 'Run Agent').click();
    cy.wait('@createSession');
    
    // Verify console shows connection and messages
    cy.get('[role="tabpanel"]').contains('Connected to sandbox WebSocket channel');
    cy.get('[role="tabpanel"]').contains('Agent execution started');
    
    // Wait for tool execution messages
    cy.get('[role="tabpanel"]').contains('Sent analytics query to watchdog_analysis tool', { timeout: 10000 });
    cy.get('[role="tabpanel"]').contains('Starting tool: watchdog_analysis', { timeout: 10000 });
    cy.get('[role="tabpanel"]').contains('Received data from tool: watchdog_analysis', { timeout: 10000 });
    cy.get('[role="tabpanel"]').contains('Completed tool: watchdog_analysis', { timeout: 10000 });
    
    // 6. Verify insight JSON is rendered
    cy.contains('button', 'Insights').click();
    cy.contains('Sales Performance Analysis').should('be.visible');
    
    // Click on the insight to view details
    cy.contains('Sales Performance Analysis').click();
    
    // Verify JSON viewer is rendered with the insight data
    cy.get('[role="tabpanel"]').contains('Raw Data');
    cy.get('[role="tabpanel"]').contains('total_sales');
    cy.get('[role="tabpanel"]').contains('1250000');
    cy.get('[role="tabpanel"]').contains('growth_rate');
    cy.get('[role="tabpanel"]').contains('0.12');
    
    // Test is complete - the entire happy path has been verified
  });
  
  // Test for error handling
  it('should handle errors gracefully', () => {
    // Override the sandbox creation to simulate an error
    cy.intercept('POST', '/api/sandboxes', {
      statusCode: 500,
      body: { success: false, error: 'Server error' }
    }).as('createSandboxError');
    
    // Try to create a sandbox
    cy.contains('button', 'Create New Sandbox').click();
    cy.wait('@createSandboxError');
    
    // Verify error toast appears
    cy.contains('Failed to create sandbox').should('be.visible');
  });
  
  // Test for WebSocket connection errors
  it('should handle WebSocket connection issues', () => {
    // Override the WebSocket to simulate connection failure
    cy.window().then((win) => {
      class FailingWebSocket extends EventTarget {
        constructor(url: string) {
          super();
          setTimeout(() => {
            this.dispatchEvent(new Event('error'));
          }, 100);
        }
        
        send() {}
        close() {}
      }
      
      win.WebSocket = FailingWebSocket as any;
    });
    
    // Set up a sandbox for testing
    cy.intercept('GET', '/api/sandboxes', {
      statusCode: 200,
      body: { success: true, sandboxes: [mockSandbox] }
    }).as('getSandboxes');
    
    // Reload to apply the WebSocket override
    cy.reload();
    cy.wait('@getTools');
    cy.wait('@getSandboxes');
    
    // Try to run the agent
    cy.contains('button', 'Run Agent').click();
    cy.wait('@createSession');
    
    // Verify error message appears
    cy.contains('WebSocket connection error').should('be.visible');
  });
});
