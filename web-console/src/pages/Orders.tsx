import { useState } from "react";
import { 
  Package, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Download,
  Filter,
  Search
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

interface Order {
  id: string;
  service: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  orderDate: string;
  completedDate?: string;
  deliverables: string[];
  paymentStatus: 'pending' | 'paid' | 'refunded';
}

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Mock data - replace with API calls
  const [orders] = useState<Order[]>([
    {
      id: 'ORD-001',
      service: 'SEO Audit & Strategy',
      description: 'Comprehensive SEO audit with actionable recommendations',
      status: 'completed',
      price: 497,
      orderDate: '2025-05-15T10:00:00Z',
      completedDate: '2025-05-22T16:30:00Z',
      deliverables: ['SEO Audit Report', 'Keyword Strategy', 'Technical SEO Checklist'],
      paymentStatus: 'paid'
    },
    {
      id: 'ORD-002',
      service: 'Content Creation Package',
      description: '10 blog posts optimized for target keywords',
      status: 'in_progress',
      price: 1200,
      orderDate: '2025-06-01T09:15:00Z',
      deliverables: ['Blog Post #1', 'Blog Post #2', 'Blog Post #3', '7 more posts'],
      paymentStatus: 'paid'
    },
    {
      id: 'ORD-003',
      service: 'Local SEO Setup',
      description: 'Google Business Profile optimization and local citations',
      status: 'pending',
      price: 299,
      orderDate: '2025-06-08T14:20:00Z',
      deliverables: ['GBP Optimization', 'Citation Building', 'Local Schema Markup'],
      paymentStatus: 'pending'
    },
    {
      id: 'ORD-004',
      service: 'Technical SEO Fixes',
      description: 'Fix crawl errors, improve site speed, and optimize meta tags',
      status: 'completed',
      price: 799,
      orderDate: '2025-04-20T11:00:00Z',
      completedDate: '2025-05-05T10:15:00Z',
      deliverables: ['Technical Audit', 'Site Speed Report', 'Meta Tags Optimization'],
      paymentStatus: 'paid'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-50 ring-green-600/20';
      case 'in_progress':
        return 'text-blue-700 bg-blue-50 ring-blue-600/20';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 ring-yellow-600/20';
      case 'cancelled':
        return 'text-red-700 bg-red-50 ring-red-600/20';
      default:
        return 'text-gray-700 bg-gray-50 ring-gray-600/20';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-700 bg-green-50 ring-green-600/20';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 ring-yellow-600/20';
      case 'refunded':
        return 'text-blue-700 bg-blue-50 ring-blue-600/20';
      default:
        return 'text-gray-700 bg-gray-50 ring-gray-600/20';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const orderDate = new Date(order.orderDate);
      const now = new Date();
      switch (dateFilter) {
        case '7d':
          matchesDate = (now.getTime() - orderDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          matchesDate = (now.getTime() - orderDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
          break;
        case '90d':
          matchesDate = (now.getTime() - orderDate.getTime()) <= 90 * 24 * 60 * 60 * 1000;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalValue = orders.reduce((sum, order) => sum + order.price, 0);
  const completedOrders = orders.filter(order => order.status === 'completed').length;
  const pendingOrders = orders.filter(order => order.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Orders</h2>
          <p className="text-muted-foreground">
            Track and manage your SEO service orders
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">All time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedOrders}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Investment in SEO</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-foreground">{order.service}</h3>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </div>

                  <p className="text-muted-foreground mb-4">{order.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Order ID</p>
                      <p className="text-sm text-muted-foreground">{order.id}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Order Date</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Price</p>
                      <p className="text-sm font-semibold text-foreground">${order.price.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-foreground mb-2">Deliverables</p>
                    <div className="flex flex-wrap gap-2">
                      {order.deliverables.map((deliverable, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground">
                          <FileText className="h-3 w-3 mr-1" />
                          {deliverable}
                        </span>
                      ))}
                    </div>
                  </div>

                  {order.completedDate && (
                    <div className="flex items-center text-sm text-green-600">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Completed on {new Date(order.completedDate).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-2 ml-6">
                  <Button variant="outline" size="sm">View Details</Button>
                  {order.status === 'completed' && (
                    <Button variant="outline" size="sm" className="flex items-center space-x-1">
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </Button>
                  )}
                  {order.paymentStatus === 'pending' && (
                    <Button size="sm">Pay Now</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}