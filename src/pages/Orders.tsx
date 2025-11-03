import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  paid: 'bg-blue-500',
  preparing: 'bg-yellow-500',
  ready: 'bg-green-500',
  served: 'bg-purple-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500'
};

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch database orders
      let dbOrders: any[] = [];
      if (user) {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            restaurants (
              name,
              image_url,
              address
            )
          `)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          dbOrders = data;
        }
      }

      // Fetch mock orders from localStorage
      const mockOrders = JSON.parse(localStorage.getItem('mockOrders') || '[]');
      
      // Transform mock orders to match database format
      const transformedMockOrders = mockOrders.map((order: any) => ({
        ...order,
        restaurants: order.restaurant ? {
          name: order.restaurant.name,
          image_url: order.restaurant.image,
          address: order.restaurant.address
        } : null
      }));

      // Combine and sort all orders
      const allOrders = [...dbOrders, ...transformedMockOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setOrders(allOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-6 py-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-foreground">My Orders</h1>
          <p className="text-muted-foreground">Track your bookings and orders</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-6 space-y-4">
        {orders.length === 0 ? (
          <Card className="p-8 text-center space-y-2">
            <p className="text-muted-foreground">No orders yet</p>
            <p className="text-sm text-muted-foreground">
              Start exploring restaurants to make your first booking
            </p>
          </Card>
        ) : (
          orders.map((order) => (
            <Card
              key={order.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex gap-4 p-4">
                <img
                  src={order.restaurants?.image_url}
                  alt={order.restaurants?.name}
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{order.restaurants?.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {order.order_type?.replace('_', ' ')}
                      </p>
                    </div>
                    <Badge className={`${statusColors[order.status]} text-white border-0`}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                    <span className="font-semibold text-primary">
                      {order.total_amount.toLocaleString()} MMK
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={selectedOrder.qr_code}
                  size={150}
                  level="H"
                  includeMargin
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Restaurant</span>
                  <span className="font-medium">{selectedOrder.restaurants?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Type</span>
                  <span className="font-medium capitalize">
                    {selectedOrder.order_type?.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium uppercase">{selectedOrder.payment_method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={`${statusColors[selectedOrder.status]} text-white border-0`}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-bold text-primary">
                    {selectedOrder.total_amount.toLocaleString()} MMK
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Items</h4>
                {selectedOrder.order_items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.name} x {item.quantity}</span>
                    <span>{(item.price * item.quantity).toLocaleString()} MMK</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Orders;
