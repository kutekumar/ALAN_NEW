import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, User, ShoppingBag, UtensilsCrossed, Loader2, XCircle } from 'lucide-react';
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
  customer_name: string;
  customer_phone: string | null;
}

const OrdersManagement = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'dine_in' | 'takeaway'>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const ORDERS_PER_PAGE = 6;

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
      
      // Fetch customer details using secure function
      const customerIds = [...new Set((data || []).map(o => o.customer_id))];
      const { data: customers, error: customersError } = await supabase.rpc('get_order_customers', {
        customer_ids: customerIds
      });

      if (customersError) {
        console.error('Failed to load customer details:', customersError);
      }

      const enrichedOrders: Order[] = (data || []).map(order => {
        const customer = customers?.find(c => c.user_id === order.customer_id);
        
        return {
          ...order,
          customer_name: customer?.full_name || 'Customer',
          customer_phone: customer?.phone || null,
        };
      });
      
      setOrders(enrichedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Expose a stable updater so external actions (like the notification modal)
  // can trigger an in-memory update via window.dispatchEvent.
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      toast.success('Order status updated');

      // Loyalty + notification logic is handled in DB trigger:
      // - trg_order_completed_loyalty on public.orders
      // - public.handle_order_completed_loyalty()
      // This keeps frontend minimal and consistent.
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  // Listen for status updates coming from other parts of the app (e.g., notification modal)
  // so OrdersManagement reflects changes without a full page reload.
  // Event is dispatched as: window.dispatchEvent(new CustomEvent('orderStatusUpdated', { detail: { orderId, status } }))
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ orderId: string; status: OrderStatus }>;
      const { orderId, status } = custom.detail || ({} as any);
      if (!orderId || !status) return;

      setOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, status } : order
        )
      );
    };

    window.addEventListener('orderStatusUpdated', handler as EventListener);

    return () => {
      window.removeEventListener('orderStatusUpdated', handler as EventListener);
    };
  }, []);

  const clearFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setDateFilter('');
    setCurrentPage(1);
  };

  const getStatusBadge = (status: OrderStatus) => {
    const badges = {
      paid: {
        label: 'Paid',
        className:
          'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/10'
      },
      preparing: {
        label: 'Preparing',
        className:
          'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/10'
      },
      ready: {
        label: 'Ready',
        className:
          'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/10'
      },
      completed: {
        label: 'Completed',
        className:
          'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/10'
      },
      cancelled: {
        label: 'Cancelled',
        className:
          'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/10'
      },
      served: {
        label: 'Served',
        className:
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/10'
      }
    };
    return badges[status] || badges.paid;
  };

  const getStatusCardClasses = (status: OrderStatus) => {
    // subtle, low-saturation backgrounds for cards
    switch (status) {
      case 'paid':
        return 'bg-purple-50/60 dark:bg-purple-500/5';
      case 'preparing':
        return 'bg-blue-50/60 dark:bg-blue-500/5';
      case 'ready':
        return 'bg-green-50/60 dark:bg-green-500/5';
      case 'completed':
        return 'bg-slate-50/60 dark:bg-slate-500/5';
      case 'served':
        return 'bg-emerald-50/60 dark:bg-emerald-500/5';
      case 'cancelled':
        return 'bg-red-50/40 dark:bg-red-500/5';
      default:
        return 'bg-card';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const filteredOrders = orders.filter((order) => {
    const matchesType =
      typeFilter === 'all' ? true : order.order_type === typeFilter;

    const matchesStatus =
      statusFilter === 'all' ? true : order.status === statusFilter;

    const matchesDate =
      !dateFilter
        ? true
        : new Date(order.created_at).toISOString().slice(0, 10) === dateFilter;

    return matchesType && matchesStatus && matchesDate;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));

  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Orders</h2>
        <p className="text-muted-foreground">Manage incoming orders and update their status</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card/60 border border-border/40 rounded-2xl p-3 glass-effect">
        {/* Order Type Filter */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Order Type
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value: 'all' | 'dine_in' | 'takeaway') => setTypeFilter(value)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="dine_in">Dine In</SelectItem>
              <SelectItem value="takeaway">Take Away</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Order Status Filter */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Status
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: OrderStatus | 'all') => setStatusFilter(value)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="served">Served</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Filter */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Date
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 w-full rounded-md border border-border/40 bg-background/60 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          />
        </div>
      </div>

      {/* Clear Filters */}
      <div className="flex justify-end -mt-1">
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <XCircle className="w-3 h-3" />
          <span>Clear filters</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No orders found for selected filters
          </CardContent>
        </Card>
      ) : (
       <>
         {/* Responsive grid for compact order cards */}
         <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
           {paginatedOrders.map((order) => {
             const badge = getStatusBadge(order.status);
             return (
               <Card
                 key={order.id}
                 className={`border border-border/40 rounded-2xl overflow-hidden transition-all duration-150 hover:shadow-md ${getStatusCardClasses(order.status)}`}
               >
                 <CardHeader className="pb-2 px-3 pt-3">
                   <div className="flex items-start justify-between gap-2">
                     {/* Left: highlight user information */}
                     <div className="flex items-start gap-1.5">
                       <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                       <div className="leading-tight">
                         <div className="text-xs font-semibold text-foreground">
                           {order.customer_name}
                         </div>
                         {order.customer_phone && (
                           <div className="text-[10px] text-muted-foreground">
                             {order.customer_phone}
                           </div>
                         )}
                       </div>
                     </div>
 
                     {/* Right: status badge + subtle order id */}
                     <div className="flex flex-col items-end gap-0.5">
                       <Badge
                         className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.className}`}
                       >
                         {badge.label}
                       </Badge>
                       <div className="text-[9px] text-muted-foreground font-mono">
                         #{order.id.substring(0, 8)}
                       </div>
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="px-3 pb-3 pt-1 space-y-2.5">
                   {/* Top meta: type + time */}
                   <div className="space-y-1.5">
                     <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                       <div className="flex items-center gap-1.5">
                         {order.order_type === 'dine_in' ? (
                           <UtensilsCrossed className="h-3.5 w-3.5" />
                         ) : (
                           <ShoppingBag className="h-3.5 w-3.5" />
                         )}
                         <span className="capitalize">
                           {order.order_type === 'dine_in' ? 'Dine in' : 'Takeaway'}
                         </span>
                       </div>
                       <div className="flex flex-col items-end gap-0">
                         <div className="flex items-center gap-1.5">
                           <Clock className="h-3.5 w-3.5" />
                           <span>{formatTimeAgo(order.created_at)}</span>
                         </div>
                         <div className="text-[8px] text-muted-foreground/80">
                           {(() => {
                             const d = new Date(order.created_at);
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
                     </div>
                   </div>

                   {/* Items summary */}
                   <div className="space-y-0.5">
                     <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                       Items
                     </h4>
                     <ul className="space-y-0.5">
                       {order.order_items.slice(0, 3).map((item: any, idx: number) => (
                         <li
                           key={idx}
                           className="text-[10px] text-muted-foreground truncate"
                         >
                           {item.quantity}x {item.name}
                         </li>
                       ))}
                       {order.order_items.length > 3 && (
                         <li className="text-[9px] text-muted-foreground/80">
                           +{order.order_items.length - 3} more item
                           {order.order_items.length - 3 > 1 ? 's' : ''}
                         </li>
                       )}
                     </ul>
                   </div>

                   {/* Footer: total + status select */}
                   <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                     <span className="font-semibold text-xs">
                       {order.total_amount.toLocaleString()} MMK
                     </span>
                     <Select
                       value={order.status}
                       onValueChange={(value) =>
                         updateOrderStatus(order.id, value as OrderStatus)
                       }
                     >
                       <SelectTrigger className="h-8 w-32 text-[10px]">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="paid">Paid</SelectItem>
                         <SelectItem value="preparing">Preparing</SelectItem>
                         <SelectItem value="ready">Ready</SelectItem>
                         <SelectItem value="served">Served</SelectItem>
                         <SelectItem value="completed">Completed</SelectItem>
                         <SelectItem value="cancelled">Cancelled</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 </CardContent>
               </Card>
             );
           })}
         </div>

         {/* Pagination controls */}
         {totalPages > 1 && (
           <div className="flex items-center justify-center gap-2 mt-4 pb-1">
             {/* Previous */}
             <button
               type="button"
               onClick={() => handlePageChange(currentPage - 1)}
               disabled={currentPage === 1}
               className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
                 currentPage === 1
                   ? 'border-border/40 text-muted-foreground/40 bg-background/40 cursor-default'
                   : 'border-border/70 text-foreground bg-background hover:bg-primary/5'
               }`}
             >
               ‹
             </button>

             {/* Page numbers */}
             {Array.from({ length: totalPages }).map((_, idx) => {
               const page = idx + 1;
               const isActive = page === currentPage;
               return (
                 <button
                   key={page}
                   type="button"
                   onClick={() => handlePageChange(page)}
                   className={`min-w-9 h-9 px-2 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                     isActive
                       ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                       : 'bg-background text-muted-foreground border-border/70 hover:bg-primary/5 hover:text-primary'
                   }`}
                 >
                   {page}
                 </button>
               );
             })}

             {/* Next */}
             <button
               type="button"
               onClick={() => handlePageChange(currentPage + 1)}
               disabled={currentPage === totalPages}
               className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
                 currentPage === totalPages
                   ? 'border-border/40 text-muted-foreground/40 bg-background/40 cursor-default'
                   : 'border-border/70 text-foreground bg-background hover:bg-primary/5'
               }`}
             >
               ›
             </button>
           </div>
         )}
       </>
     )}
    </div>
  );
};

export default OrdersManagement;
