import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, User, ShoppingBag, UtensilsCrossed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type OrderStatus = 'paid' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'served';

interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  order_items: any;
  order_type: 'dine_in' | 'takeaway';
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

const OrdersManagement = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      // First get the restaurant owned by this user
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (restaurantError) throw restaurantError;

      // Then get orders for this restaurant
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profile names separately
      const ordersWithProfiles = await Promise.all(
        (data || []).map(async (order) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', order.customer_id)
            .single();
          return { ...order, profiles: profile };
        })
      );
      
      setOrders(ordersWithProfiles as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      toast.success('Order status updated');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    const badges = {
      paid: { label: 'Paid', className: 'bg-purple-500/20 text-purple-700 dark:text-purple-400' },
      preparing: { label: 'Preparing', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
      ready: { label: 'Ready', className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
      completed: { label: 'Completed', className: 'bg-gray-500/20 text-gray-700 dark:text-gray-400' },
      cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
      served: { label: 'Served', className: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' }
    };
    return badges[status] || badges.paid;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Orders</h2>
        <p className="text-muted-foreground">Manage incoming orders and update their status</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No orders yet
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="border-border/50 luxury-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">Order #{order.id.substring(0, 8)}</CardTitle>
                  <Badge className={getStatusBadge(order.status).className}>
                    {getStatusBadge(order.status).label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{order.profiles?.full_name || 'Customer'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {order.order_type === 'dine_in' ? (
                        <UtensilsCrossed className="h-4 w-4" />
                      ) : (
                        <ShoppingBag className="h-4 w-4" />
                      )}
                      <span>{order.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeAgo(order.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Items:</h4>
                  <ul className="space-y-1">
                    {order.order_items.map((item: any, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        {item.quantity}x {item.name}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="font-semibold text-lg">
                    Total: {order.total_amount.toLocaleString()} MMK
                  </span>
                  <Select
                    value={order.status}
                    onValueChange={(value) => updateOrderStatus(order.id, value as OrderStatus)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersManagement;
