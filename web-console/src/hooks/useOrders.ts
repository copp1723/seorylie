import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersAPI } from '../services/orders';
import { queryKeys } from '../lib/queryClient';
import { downloadFile } from '../lib/api';

export const useOrders = (params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => ordersAPI.getOrders(params),
    keepPreviousData: true,
  });
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersAPI.getOrder(id),
    enabled: !!id,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      service: string;
      description: string;
      price: number;
      deliverables: string[];
    }) => ordersAPI.createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      ordersAPI.updateOrderStatus(id, status as any),
    onSuccess: (updatedOrder) => {
      // Update specific order in cache
      queryClient.setQueryData(
        queryKeys.orders.detail(updatedOrder.id),
        updatedOrder
      );
      
      // Invalidate orders list
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
};

export const useProcessPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, paymentMethod }: {
      orderId: string;
      paymentMethod: {
        type: 'card' | 'bank_transfer' | 'paypal';
        details: any;
      };
    }) => ordersAPI.processPayment(orderId, paymentMethod),
    onSuccess: (_, { orderId }) => {
      // Invalidate order data to refresh payment status
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
};

export const useOrderDeliverables = (orderId: string) => {
  return useQuery({
    queryKey: ['orders', orderId, 'deliverables'],
    queryFn: () => ordersAPI.getDeliverables(orderId),
    enabled: !!orderId,
  });
};

export const useDownloadDeliverable = () => {
  return useMutation({
    mutationFn: async ({ orderId, deliverableId, filename }: {
      orderId: string;
      deliverableId: string;
      filename: string;
    }) => {
      const blob = await ordersAPI.downloadDeliverable(orderId, deliverableId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  });
};

export const useOrderInvoice = (orderId: string) => {
  return useQuery({
    queryKey: ['orders', orderId, 'invoice'],
    queryFn: () => ordersAPI.getInvoice(orderId),
    enabled: !!orderId,
  });
};

export const useOrderAnalytics = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: ['orders', 'analytics', dateRange],
    queryFn: () => ordersAPI.getOrderAnalytics(dateRange),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useRequestRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => 
      ordersAPI.requestRefund(orderId, reason),
    onSuccess: (_, { orderId }) => {
      // Invalidate order data to show refund status
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
    },
  });
};