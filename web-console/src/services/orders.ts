// import api from '../lib/api';
const api = { get: async () => ({}), post: async () => ({}), put: async () => ({}), delete: async () => ({}) };
import type {
  Order,
  OrderStatus,
  CreateOrderRequest,
  Deliverable,
  PaymentMethod,
  PaymentResponse,
  Invoice,
  OrderAnalytics
} from '../types/api';

export const ordersAPI = {
  // Get all orders
  getOrders: async (params?: any): Promise<Order[]> => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  // Get specific order
  getOrder: async (orderId: string): Promise<Order> => {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  },

  // Create new order
  createOrder: async (orderData: CreateOrderRequest): Promise<Order> => {
    const response = await api.post('/orders', orderData);
    return response.data;
  },

  // Update order status
  updateOrderStatus: async (orderId: string, status: OrderStatus): Promise<Order> => {
    const response = await api.patch(`/orders/${orderId}/status`, { status });
    return response.data;
  },

  // Cancel order
  cancelOrder: async (orderId: string): Promise<Order> => {
    const response = await api.patch(`/orders/${orderId}/cancel`);
    return response.data;
  },

  // Get order invoice
  getOrderInvoice: async (orderId: string): Promise<Blob> => {
    const response = await api.get(`/orders/${orderId}/invoice`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Process payment
  processPayment: async (orderId: string, paymentMethod: PaymentMethod): Promise<PaymentResponse> => {
    const response = await api.post(`/orders/${orderId}/payment`, { paymentMethod });
    return response.data;
  },

  // Get deliverables
  getDeliverables: async (orderId: string): Promise<Deliverable[]> => {
    const response = await api.get(`/orders/${orderId}/deliverables`);
    return response.data;
  },

  // Download deliverable
  downloadDeliverable: async (orderId: string, deliverableId: string): Promise<Blob> => {
    const response = await api.get(`/orders/${orderId}/deliverables/${deliverableId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get invoice
  getInvoice: async (orderId: string): Promise<Invoice> => {
    const response = await api.get(`/orders/${orderId}/invoice`);
    return response.data;
  },

  // Get order analytics
  getOrderAnalytics: async (dateRange: string): Promise<OrderAnalytics> => {
    const response = await api.get('/orders/analytics', { params: { dateRange } });
    return response.data;
  },

  // Request refund
  requestRefund: async (orderId: string, reason: string): Promise<void> => {
    await api.post(`/orders/${orderId}/refund`, { reason });
  }
};
