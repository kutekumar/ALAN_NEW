import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  UtensilsCrossed,
  Receipt,
  ScanLine,
  LayoutList,
  Settings,
  Bell,
  BellDot,
  CheckCircle2
} from 'lucide-react';
import OrdersManagement from '@/components/dashboard/OrdersManagement';
import QRScanner from '@/components/dashboard/QRScanner';
import MenuManagement from '@/components/dashboard/MenuManagement';
import RestaurantSettings from '@/components/dashboard/RestaurantSettings';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const RestaurantDashboard = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'orders' | 'scanner' | 'menu' | 'settings'>('orders');

  const {
    restaurantId,
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markAllAsRead,
    markAsRead,
  } = useOrderNotifications({ limit: 50, enableSound: true });

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleOpenNotificationOrder = async (notification: any) => {
    if (!notification?.order_id) return;
    setSelectedOrderId(notification.order_id);
    setOrderDetail(null);
    setOrderDetailOpen(true);

    // Mark this notification as read optimistically
    if (notification.id) {
      markAsRead(notification.id);
    }

    // Lazy-load specific order details for modal
    try {
      const { supabase } = await import('@/integrations/supabase/client');

      // 1) Fetch the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(
          `
          id,
          order_items,
          total_amount,
          status,
          created_at,
          order_type,
          customer_id
        `
        )
        .eq('id', notification.order_id)
        .single();

      if (orderError || !orderData) {
        console.error('Failed to load order detail for notification:', orderError);
        return;
      }

      // 2) Fetch customer profile exactly like OrdersManagement does (get_order_customers)
      let customerName: string | null = null;
      let customerPhone: string | null = null;

      if (orderData.customer_id) {
        const { data: customers, error: customersError } = await supabase.rpc(
          'get_order_customers',
          { customer_ids: [orderData.customer_id] }
        );

        if (customersError) {
          console.error('Failed to load customer details for modal:', customersError);
        } else if (customers && customers.length > 0) {
          const customer = customers[0];
          customerName =
            (customer.full_name && String(customer.full_name).trim()) || null;
          customerPhone =
            (customer.phone && String(customer.phone).trim()) || null;
        }
      }

      // 3) Also respect enriched name from notification if present
      if (
        !customerName &&
        notification.customer_name &&
        typeof notification.customer_name === 'string' &&
        notification.customer_name.trim()
      ) {
        customerName = notification.customer_name.trim();
      }

      setOrderDetail({
        ...orderData,
        customer_display_name: customerName,
        customer_display_phone: customerPhone,
      });
    } catch (err) {
      console.error('Error loading order detail module:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background pb-20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full luxury-gradient flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Restaurant Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Manage your restaurant
                {restaurantId ? ' • Live order notifications enabled' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card/70 hover:bg-primary/5 transition-colors"
                >
                  <Bell className="w-5 h-5 text-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[360px] max-h-[420px] p-0 overflow-hidden"
              >
                <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Order Notifications</span>
                    <span className="text-[10px] text-muted-foreground">
                      {notificationsLoading
                        ? 'Loading...'
                        : notifications.length === 0
                        ? 'No notifications yet'
                        : `${unreadCount} unread • ${notifications.length} total`}
                    </span>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAllAsRead();
                      }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Scroll vertically, never cut off lower items */}
                <ScrollArea className="max-h-[340px]">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      You will see new orders here in real time.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const title =
                        n.customer_name && n.total_amount
                          ? `${n.customer_name} placed an order of ${Number(
                              n.total_amount
                            ).toLocaleString()} MMK`
                          : n.message || 'New order received';

                      return (
                        <DropdownMenuItem
                          key={n.id}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${
                            n.status === 'unread'
                              ? 'bg-primary/5 hover:bg-primary/10'
                              : 'hover:bg-muted/60'
                          }`}
                          onClick={() => handleOpenNotificationOrder(n)}
                        >
                          {/* Left icon: red dot for unread, outlined circle for read */}
                          <div className="mt-1">
                            {n.status === 'unread' ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 block" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>

                          {/* Text content */}
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex-1">
                              <div
                                className={`text-xs ${
                                  n.status === 'unread'
                                    ? 'font-semibold text-foreground'
                                    : 'font-normal text-foreground'
                                }`}
                              >
                                {title}
                              </div>
                            </div>
                            <div className="mt-0.5 text-[9px] text-muted-foreground text-right">
                              {(() => {
                                const d = new Date(n.created_at);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                let hours = d.getHours();
                                const minutes = String(d.getMinutes()).padStart(2, '0');
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12 || 12;
                                return `${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
                              })()}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Logout */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {activeTab === 'orders' && <OrdersManagement />}
        {activeTab === 'scanner' && <QRScanner />}
        {activeTab === 'menu' && <MenuManagement />}
        {activeTab === 'settings' && <RestaurantSettings />}

        {/* Order Detail Modal for notifications */}
        <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>
                View details for this order from your notifications.
              </DialogDescription>
            </DialogHeader>
            {!orderDetail ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading order details...
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {/* Order ID */}
                <div className="flex justify-between">
                  <span className="font-medium">Order ID</span>
                  <span className="font-mono text-xs">
                    {String(orderDetail.id).substring(0, 8)}
                  </span>
                </div>

                {/* Customer info: use same mechanism as OrdersManagement (get_order_customers) */}
                <div className="flex justify-between">
                  <span className="font-medium">Customer</span>
                  <span>
                    {(() => {
                      const name =
                        (orderDetail.customer_display_name &&
                          String(orderDetail.customer_display_name).trim()) ||
                        null;
                      const phone =
                        (orderDetail.customer_display_phone &&
                          String(orderDetail.customer_display_phone).trim()) ||
                        null;

                      if (name && phone) return `${name} • ${phone}`;
                      if (name) return name;
                      if (phone) return phone;

                      // If everything fails, neutral fallback:
                      return 'Customer';
                    })()}
                  </span>
                </div>

                {/* Total */}
                <div className="flex justify-between">
                  <span className="font-medium">Total Amount</span>
                  <span className="font-semibold">
                    {Number(orderDetail.total_amount || 0).toLocaleString()} MMK
                  </span>
                </div>

                {/* Status with inline updater that syncs Orders list */}
                <div className="flex justify-between items-center gap-3">
                  <span className="font-medium">Status</span>
                  <select
                    className="text-xs px-2 py-1 border border-border rounded-md bg-background capitalize"
                    value={orderDetail.status || 'paid'}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        const { supabase } = await import('@/integrations/supabase/client');
                        const { error } = await supabase
                          .from('orders')
                          .update({ status: newStatus })
                          .eq('id', orderDetail.id);

                        if (error) {
                          console.error('Failed to update order status from modal:', error);
                          return;
                        }

                        // Update local modal state so UI reflects change
                        setOrderDetail((prev: any) =>
                          prev ? { ...prev, status: newStatus } : prev
                        );

                        // Broadcast to OrdersManagement so it updates in-memory without reload
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('orderStatusUpdated', {
                              detail: { orderId: orderDetail.id, status: newStatus },
                            })
                          );
                        }
                      } catch (err) {
                        console.error('Error updating order status from modal:', err);
                      }
                    }}
                  >
                    <option value="paid">Paid</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="served">Served</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Type</span>
                  <span className="capitalize">
                    {orderDetail.order_type || 'dine_in'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Placed At</span>
                  <div className="text-xs text-muted-foreground">
                    {orderDetail.created_at
                      ? (() => {
                          const d = new Date(orderDetail.created_at);
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = d.getFullYear();
                          let hours = d.getHours();
                          const minutes = String(d.getMinutes()).padStart(2, '0');
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          hours = hours % 12 || 12;
                          return `${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
                        })()
                      : ''}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Items</span>
                  <ul className="mt-1 space-y-0.5">
                    {(orderDetail.order_items || []).map(
                      (item: any, idx: number) => (
                        <li
                          key={idx}
                          className="flex justify-between text-xs text-muted-foreground"
                        >
                          <span>
                            {item.quantity}x {item.name}
                          </span>
                          {item.price && (
                            <span>
                              {Number(item.price * item.quantity).toLocaleString()}{' '}
                              MMK
                            </span>
                          )}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>

      {/* Bottom Navigation - matches customer homepage style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border glass-effect z-50">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-4">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center justify-center flex-1 transition-colors ${
              activeTab === 'orders' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Receipt className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex flex-col items-center justify-center flex-1 transition-colors ${
              activeTab === 'scanner' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <ScanLine className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">QR Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center justify-center flex-1 transition-colors ${
              activeTab === 'menu' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <LayoutList className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Menu</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center flex-1 transition-colors ${
              activeTab === 'settings' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Settings className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default RestaurantDashboard;
