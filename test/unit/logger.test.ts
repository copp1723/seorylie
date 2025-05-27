/**
 * Unit tests for the enhanced logger utility
 */
import logger, {
  debug,
  info,
  warn,
  error,
  http,
  requestLogger,
  responseCapture,
  shutdownLogger
} from '../../server/utils/logger';

// Mock winston
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    colorize: jest.fn().mockReturnThis(),
    printf: jest.fn().mockReturnThis(),
    errors: jest.fn().mockReturnThis()
  };
  
  const mockTransports = {
    Console: jest.fn().mockImplementation(() => ({})),
    DailyRotateFile: jest.fn().mockImplementation(() => ({
      on: jest.fn()
    }))
  };
  
  return {
    format: mockFormat,
    createLogger: jest.fn().mockImplementation(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      http: jest.fn(),
      on: jest.fn(),
      end: jest.fn(),
      transports: [{}]
    })),
    addColors: jest.fn(),
    transports: mockTransports
  };
});

// Mock path and fs
jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/mock/logs')
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should provide debug logging function', () => {
    // Act
    debug('Debug message', { context: 'test' });
    
    // Assert
    expect(jest.isMockFunction(debug)).toBeTruthy();
    expect(debug).toHaveBeenCalledWith('Debug message', { context: 'test' });
  });
  
  test('should provide info logging function', () => {
    // Act
    info('Info message', { context: 'test' });
    
    // Assert
    expect(jest.isMockFunction(info)).toBeTruthy();
    expect(info).toHaveBeenCalledWith('Info message', { context: 'test' });
  });
  
  test('should provide warn logging function', () => {
    // Act
    warn('Warning message', { context: 'test' });
    
    // Assert
    expect(jest.isMockFunction(warn)).toBeTruthy();
    expect(warn).toHaveBeenCalledWith('Warning message', { context: 'test' });
  });
  
  test('should provide error logging function with error object', () => {
    // Arrange
    const testError = new Error('Test error');
    
    // Act
    error('Error message', testError, { context: 'test' });
    
    // Assert
    expect(jest.isMockFunction(error)).toBeTruthy();
    expect(error).toHaveBeenCalled();
  });
  
  test('should provide HTTP logging function', () => {
    // Act
    http('HTTP message', { method: 'GET', path: '/test' });
    
    // Assert
    expect(jest.isMockFunction(http)).toBeTruthy();
    expect(http).toHaveBeenCalledWith('HTTP message', { method: 'GET', path: '/test' });
  });
  
  test('should provide request logger middleware', () => {
    // Arrange
    const req = {
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
      user: { id: 'user-1' },
      apiKey: { id: 'key-1', dealershipId: 'dealer-1' }
    };
    
    const res = {
      on: jest.fn(),
      statusCode: 200,
      locals: {}
    };
    
    const next = jest.fn();
    
    // Act
    const middleware = requestLogger();
    middleware(req as any, res as any, next);
    
    // Assert - middleware calls next
    expect(next).toHaveBeenCalled();
    
    // Simulate response finishing
    const [event, callback] = res.on.mock.calls[0];
    expect(event).toBe('finish');
    
    // Execute the finish callback
    callback();
    
    // HTTP logging should have been called
    expect(http).toHaveBeenCalled();
  });
  
  test('should provide response capture middleware', () => {
    // Arrange
    const req = {};
    const res = {
      send: jest.fn().mockReturnThis(),
      locals: {}
    };
    const next = jest.fn();
    const responseBody = { test: 'data' };
    
    // Act
    const middleware = responseCapture();
    middleware(req as any, res as any, next);
    
    // Assert - middleware calls next
    expect(next).toHaveBeenCalled();
    
    // Use the modified send function
    res.send(responseBody);
    
    // Response should be captured in locals
    expect(res.locals.responseBody).toBe(responseBody);
  });
  
  test('should provide shutdown function', async () => {
    // Act
    const shutdownPromise = shutdownLogger();
    
    // Assert
    expect(shutdownPromise).toBeInstanceOf(Promise);
    
    // Resolve the promise to check it completes
    await expect(shutdownPromise).resolves.toBeUndefined();
  });
  
  test('should skip health endpoints in request logger', () => {
    // Arrange
    const req = {
      path: '/api/health',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn()
    };
    
    const res = { on: jest.fn() };
    const next = jest.fn();
    
    // Act
    const middleware = requestLogger();
    middleware(req as any, res as any, next);
    
    // Assert - middleware calls next but doesn't set up response listener
    expect(next).toHaveBeenCalled();
    expect(res.on).not.toHaveBeenCalled();
  });
});