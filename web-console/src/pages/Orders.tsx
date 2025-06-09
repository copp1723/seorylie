import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ShoppingCart, Package, Clock, CheckCircle, Download, CreditCard } from "lucide-react";

export default function Orders() {
  const mockOrders = [
    {
      id: 'ord_001',
      service: 'SEO Audit Report',
      price: 299,
      status: 'completed',
      orderDate: '2025-05-15',
      completedDate: '2025-05-20',
      description: 'Comprehensive website SEO analysis'
    },
    {
      id: 'ord_002',
      service: 'Content Strategy Package',
      price: 599,
      status: 'in_progress',
      orderDate: '2025-06-01',
      description: '3-month content calendar with keyword research'
    },
    {
      id: 'ord_003',
      service: 'Technical SEO Fix',
      price: 199,
      status: 'pending',
      orderDate: '2025-06-08',
      description: 'Fix site speed and crawling issues'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Package className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Track your SEO service orders and deliverables
          </p>
        </div>
        <Button className="flex items-center space-x-2">
          <ShoppingCart className="h-4 w-4" />
          <span>Browse Services</span>
        </Button>
      </div>

      {/* Order Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">62.5% completion rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Active projects</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,497</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Your latest service orders and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(order.status)}
                  <div>
                    <h3 className="font-medium">{order.service}</h3>
                    <p className="text-sm text-muted-foreground">{order.description}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-sm font-medium">${order.price}</span>
                      <span className="text-xs text-muted-foreground">Ordered: {order.orderDate}</span>
                      {order.completedDate && (
                        <span className="text-xs text-muted-foreground">Completed: {order.completedDate}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                    order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.status.replace('_', ' ')}
                  </span>
                  {order.status === 'completed' && (
                    <Button variant="outline" size="sm" className="flex items-center space-x-1">
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </Button>
                  )}
                  <Button variant="outline" size="sm">View</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Services */}
      <Card>
        <CardHeader>
          <CardTitle>Available Services</CardTitle>
          <CardDescription>Professional SEO services you can order</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'SEO Audit', price: 299, description: 'Complete website analysis' },
              { name: 'Content Package', price: 599, description: '10 optimized blog posts' },
              { name: 'Technical SEO', price: 399, description: 'Site speed & structure fixes' },
              { name: 'Link Building', price: 799, description: 'Quality backlink acquisition' },
              { name: 'Local SEO Setup', price: 199, description: 'Google Business optimization' },
              { name: 'Monthly Maintenance', price: 299, description: 'Ongoing SEO monitoring' }
            ].map((service, index) => (
              <div key={index} className="p-4 border border-border rounded-lg">
                <h4 className="font-medium">{service.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-bold">${service.price}</span>
                  <Button size="sm">Order Now</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}