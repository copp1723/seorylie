
// Simple WebSocket utilities to replace missing imports
// This creates the exports that ChatInterface.tsx is looking for

let ws: WebSocket | null = null;
let isConnected = false;
let messageHandlers: ((data: any) => void)[] = [];
let connectionHandlers: ((connected: boolean) => void)[] = [];

export const connectWebSocket = (url: string): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        isConnected = true;
        connectionHandlers.forEach(handler => handler(true));
        resolve(ws!);
      };
      
      ws.onclose = () => {
        isConnected = false;
        connectionHandlers.forEach(handler => handler(false));
      };
      
      ws.onerror = (error) => {
        isConnected = false;
        connectionHandlers.forEach(handler => handler(false));
        reject(error);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          messageHandlers.forEach(handler => handler(data));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
    } catch (error) {
      reject(error);
    }
  });
};

export const sendMessage = (message: any): void => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn('WebSocket not connected, message not sent:', message);
  }
};

export const onMessage = (handler: (data: any) => void): () => void => {
  messageHandlers.push(handler);
  
  // Return cleanup function
  return () => {
    const index = messageHandlers.indexOf(handler);
    if (index > -1) {
      messageHandlers.splice(index, 1);
    }
  };
};

export const onConnectionChange = (handler: (connected: boolean) => void): () => void => {
  connectionHandlers.push(handler);
  
  // Call immediately with current state
  handler(isConnected);
  
  // Return cleanup function
  return () => {
    const index = connectionHandlers.indexOf(handler);
    if (index > -1) {
      connectionHandlers.splice(index, 1);
    }
  };
};

export const disconnectWebSocket = (): void => {
  if (ws) {
    ws.close();
    ws = null;
    isConnected = false;
  }
};

export { isConnected };
