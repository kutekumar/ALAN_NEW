import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Printer, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  total_amount: number;
  order_type: string;
  status: string;
  created_at: string;
  customer_name: string;
  restaurant_name: string;
}

const AdminOrders = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      toast.error('Admin access required');
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchOrders();
    }
  }, [user, userRole]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, dateFilter, orders]);

  const fetchOrders = async () => {
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersError) {
      toast.error('Failed to load orders');
      return;
    }

    // Fetch customer names
    const customerIds = [...new Set(ordersData.map(o => o.customer_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', customerIds);

    // Fetch restaurant names
    const restaurantIds = [...new Set(ordersData.map(o => o.restaurant_id))];
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name')
      .in('id', restaurantIds);

    const enrichedOrders: Order[] = ordersData.map(order => ({
      ...order,
      customer_name: profiles?.find(p => p.id === order.customer_id)?.full_name || 'Unknown',
      restaurant_name: restaurants?.find(r => r.id === order.restaurant_id)?.name || 'Unknown',
    }));

    setOrders(enrichedOrders);
    setFilteredOrders(enrichedOrders);
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      if (dateFilter === 'today') {
        filterDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === 'week') {
        filterDate.setDate(now.getDate() - 7);
      } else if (dateFilter === 'month') {
        filterDate.setMonth(now.getMonth() - 1);
      }

      filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
    }

    setFilteredOrders(filtered);
  };

  const handlePrint = () => {
    window.print();
  };

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
      paid: 'default',
      preparing: 'secondary',
      ready: 'outline',
      completed: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status.toUpperCase()}</Badge>;
  };

  if (loading || !user || userRole !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl print:p-0">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 print:hidden">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground">Orders Report</h1>
            <p className="text-muted-foreground">View and manage all orders</p>
          </div>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>

        {/* Print Header (Hidden on screen) */}
        <div className="hidden print:block mb-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">ALAN - Orders Report</h1>
            <p className="text-muted-foreground">Generated on {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{filteredOrders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalRevenue.toLocaleString()} MMK</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Average Order</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length).toLocaleString() : 0} MMK
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 print:hidden">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.id.substring(0, 8)}</TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell>{order.restaurant_name}</TableCell>
                      <TableCell className="capitalize">{order.order_type}</TableCell>
                      <TableCell className="font-semibold">{Number(order.total_amount).toLocaleString()} MMK</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOrders;
