import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Star,
  MapPin,
  Loader2,
  User as UserIcon,
  Bell,
  Sparkles,
  Compass,
  Star as StarIcon,
  Shield,
  Crown,
  LogOut,
  MessageCircle,
} from 'lucide-react';
import ALANLogo from '@/imgs/ALANLOGO.png';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCustomerLoyalty } from '@/hooks/useCustomerLoyalty';
import CircularRestaurantGallery from '@/components/CircularRestaurantGallery';

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  cuisine_type: string | null;
  address: string;
  phone: string | null;
  image_url: string | null;
  rating: number | null;
  distance: string | null;
  open_hours: string | null;
}

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<
    {
      id: string;
      order_id?: string | null;
      title: string;
      message: string;
      status: 'unread' | 'read';
      created_at: string;
      reply_content?: string;
      restaurant_name?: string;
      blog_post_id?: string;
    }[]
  >([]);
  const [selectedNotification, setSelectedNotification] = useState<{
    id: string;
    order_id?: string | null;
    title: string;
    message: string;
    created_at: string;
    reply_content?: string;
    restaurant_name?: string;
    blog_post_id?: string;
  } | null>(null);
  const [selectedNotificationOrder, setSelectedNotificationOrder] = useState<any | null>(null);
  const [selectedBlogPost, setSelectedBlogPost] = useState<any | null>(null);
  const [profileMenuRef, setProfileMenuRef] = useState<HTMLDivElement | null>(null);
  const [notificationsRef, setNotificationsRef] = useState<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { loading: loyaltyLoading, summary, badgeLabel, badgeIcon } = useCustomerLoyalty();

  const displayName =
    (user?.user_metadata as any)?.full_name || user?.email || 'Guest';
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };
  const handleLogout = async () => {
    await signOut();
    setShowProfileMenu(false);
    navigate('/auth');
  };

  const getBadgeIconNode = () => {
    const base =
      'w-3.5 h-3.5 text-yellow-300 drop-shadow-[0_0_6px_rgba(250,250,210,0.9)]';
    switch (badgeIcon) {
      case 'compass':
        return <Compass className={base} />;
      case 'star':
        return <StarIcon className={base} />;
      case 'shield':
        return <Shield className={base} />;
      case 'crown':
        return <Crown className={base} />;
      case 'sparkles':
      default:
        return <Sparkles className={base} />;
    }
  };

  const loadNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('customer_notifications')
      .select('id, order_id, title, message, status, created_at, reply_content, restaurant_name, blog_post_id')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Failed to load notifications', error);
      return;
    }
   setNotifications(
      (data || []) as {
        id: string;
        order_id?: string | null;
        title: string;
        message: string;
        status: 'unread' | 'read';
        created_at: string;
        reply_content?: string;
        restaurant_name?: string;
        blog_post_id?: string;
      }[]
    );
  };

  // Simple loader for notification sound (aligned with useOrderNotifications)
  // Uses public/sound/notification.mp3 so it works in production build.
  const getNotificationAudio = () => {
    const audio = new Audio('/sound/notification.mp3');
    audio.preload = 'auto';
    return audio;
  };

  const playNotificationSound = () => {
    try {
      const audio = getNotificationAudio();
      audio.play().catch(() => {
        // ignore autoplay restriction errors
      });
    } catch {
      // no-op
    }
  };

  // Initial notifications load + realtime subscription (with sound + rating-modal trigger)
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    loadNotifications();

    const channel = supabase
      .channel(`customer-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_notifications',
          filter: `customer_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const row = payload.new;
          const incoming = {
            id: row.id,
            order_id: row.order_id,
            title: row.title,
            message: row.message,
            status: row.status as 'unread' | 'read',
            created_at: row.created_at,
            reply_content: row.reply_content,
            restaurant_name: row.restaurant_name,
            blog_post_id: row.blog_post_id,
          };

          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, 20);
          });

          // Play sound for any new notification (Grab-like real-time feel)
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  // Close profile and notification menus when clicking outside
  useEffect(() => {
    if (!showProfileMenu && !showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        showProfileMenu &&
        profileMenuRef &&
        !profileMenuRef.contains(target)
      ) {
        setShowProfileMenu(false);
      }
      if (
        showNotifications &&
        notificationsRef &&
        !notificationsRef.contains(target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu, showNotifications, profileMenuRef, notificationsRef]);

  const openNotification = async (n: {
    id: string;
    order_id?: string | null;
    title: string;
    message: string;
    status: 'unread' | 'read';
    created_at: string;
    reply_content?: string;
    restaurant_name?: string;
    blog_post_id?: string;
  }) => {
    // Store context globally for StarRating to use when submitting
    if (typeof window !== 'undefined') {
      (window as any).__alan_activeRatingNotificationId = n.id;
      (window as any).__alan_activeRatingNotificationOrderId = n.order_id || null;
    }

    setSelectedNotification(n);
    setSelectedNotificationOrder(null);
    setShowNotifications(false);

    // If this notification is about an order (e.g. "Order placed"), fetch a rich summary
    if (n.order_id) {
      try {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(
            `
            id,
            status,
            order_type,
            total_amount,
            created_at,
            order_items,
            restaurants (
              name,
              image_url,
              address
            )
          `
          )
          .eq('id', n.order_id)
          .single();

        if (!orderError && order) {
          setSelectedNotificationOrder(order);
        }
      } catch (err) {
        console.error('Failed to load order summary for notification', err);
      }
    }

    // If this is a blog comment reply notification, fetch the blog post details
    if (n.blog_post_id && n.title === 'Comment Reply') {
      try {
        const { data: blogPost, error: blogError } = await supabase
          .from('blog_posts')
          .select(
            `
            id,
            title,
            excerpt,
            content,
            hero_image_url,
            created_at,
            restaurants (
              name,
              image_url
            )
          `
          )
          .eq('id', n.blog_post_id)
          .single();

        if (!blogError && blogPost) {
          setSelectedBlogPost(blogPost);
        }
      } catch (err) {
        console.error('Failed to load blog post for notification', err);
      }
    }

    if (n.status === 'unread') {
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, status: 'read' } : x
        )
      );
      const { error } = await supabase
        .from('customer_notifications')
        .update({ status: 'read' })
        .eq('id', n.id);
      if (error) console.error('Failed to mark notification read', error);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('rating', { ascending: false });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      toast.error('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (restaurant.cuisine_type?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Luxury top nav bar with logo, loyalty, and notifications */}
      <div className="sticky top-0 z-40 py-2 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-md px-4">
          <div className="luxury-gradient text-white rounded-xl shadow-md">
            <div className="px-4 py-2 flex items-center justify-between gap-3">
              <img
                src={ALANLogo}
                alt="ALAN Logo"
                className="h-7 w-auto object-contain drop-shadow"
              />
              <div className="flex items-center gap-2 relative">
                {/* Notification bell */}
                {user && (
                  <div
                    className="relative"
                    ref={(el) => setNotificationsRef(el)}
                  >
                    <button
                      onClick={() => {
                        setShowNotifications((prev) => !prev);
                        setShowProfileMenu(false);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
                      aria-label="Notifications"
                    >
                      <Bell className="h-4 w-4 text-white" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-red-500 text-[9px] leading-[14px] text-white flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-background/95 backdrop-blur border border-border/60 rounded-2xl shadow-lg overflow-hidden z-50">
                        <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-foreground">
                              Activity
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              Loyalty & orders
                            </span>
                          </div>
                          {notifications.length > 0 && (
                            <button
                              onClick={async () => {
                                const unreadIds = notifications
                                  .filter((n) => n.status === 'unread')
                                  .map((n) => n.id);
                                if (unreadIds.length === 0) return;
                                const { error } = await supabase
                                  .from('customer_notifications')
                                  .update({ status: 'read' })
                                  .in('id', unreadIds);
                                if (!error) {
                                  setNotifications((prev) =>
                                    prev.map((n) =>
                                      unreadIds.includes(n.id)
                                        ? { ...n, status: 'read' }
                                        : n
                                    )
                                  );
                                } else {
                                  console.error('Failed to mark all read', error);
                                }
                              }}
                              className="text-[8px] px-2 py-1 rounded-full bg-primary/5 text-primary hover:bg-primary/10"
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="px-3 py-4 text-[10px] text-muted-foreground">
                              No notifications yet. You will see your order and loyalty updates here.
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <button
                                key={n.id}
                                onClick={() => openNotification(n)}
                                className={`w-full px-3 py-2.5 flex items-start gap-2 hover:bg-accent/40 transition-colors ${
                                  n.status === 'unread'
                                    ? 'bg-primary/5'
                                    : ''
                                }`}
                              >
                                {/* Read/unread indicator */}
                                <div className="mt-1 w-2 h-2">
                                  {n.status === 'unread' ? (
                                    <span className="block w-2 h-2 rounded-full bg-red-500" />
                                  ) : (
                                    <span className="block w-2 h-2 rounded-full border border-emerald-500 bg-emerald-500/0 relative">
                                      <span className="absolute inset-[2px] bg-emerald-500 rounded-full" />
                                    </span>
                                  )}
                                </div>
                                {/* Text block */}
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                  <div
                                    className={`text-[9px] text-left ${
                                      n.status === 'unread'
                                        ? 'font-semibold text-foreground'
                                        : 'font-normal text-foreground'
                                    }`}
                                  >
                                    {n.message}
                                  </div>
                                  <div className="text-[8px] text-muted-foreground/70 text-right">
                                    {(() => {
                                      const d = new Date(n.created_at);
                                      const day = String(d.getDate()).padStart(2, '0');
                                      const month = String(d.getMonth() + 1).padStart(2, '0');
                                      const year = d.getFullYear();
                                      let hours = d.getHours();
                                      const minutes = String(d.getMinutes()).padStart(2, '0');
                                      const ampm = hours >= 12 ? 'PM' : 'AM';
                                      hours = hours % 12 || 12;
                                      return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
                                    })()}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Profile + badge minimal menu */}
                <div
                  className="relative"
                  ref={(el) => setProfileMenuRef(el)}
                >
                  <button
                    onClick={() => {
                      setShowProfileMenu((prev) => !prev);
                      setShowNotifications(false);
                    }}
                    className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-all border border-white/20 shadow-sm"
                    aria-label="Profile & loyalty menu"
                  >
                    <UserIcon className="h-4 w-4 text-white" />
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center border border-yellow-300/80 shadow-md">
                      {getBadgeIconNode()}
                    </span>
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-background/95 backdrop-blur border border-border/60 rounded-2xl shadow-lg overflow-hidden z-50">
                      <div className="px-3 py-2.5 border-b border-border/40 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full luxury-gradient flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-semibold text-foreground truncate">
                            {displayName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                              className="px-1.5 py-0 text-[8px] rounded-full bg-primary/10 text-primary border-primary/20"
                            >
                              {loyaltyLoading
                                ? 'Calculating badge...'
                                : badgeLabel || 'Newbie'}
                            </Badge>
                          </div>
                        </div>
                        {summary && (
                          <div className="w-14 h-14 rounded-full bg-primary flex flex-col items-center justify-center leading-tight shadow-sm">
                            <span className="text-[14px] font-semibold text-white">
                              {summary.total_points}
                            </span>
                            <span className="text-[8px] uppercase tracking-wide text-white/85">
                              pts
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            navigate('/profile');
                          }}
                          className="w-full px-3 py-2 text-[10px] text-left hover:bg-accent/40 flex items-center gap-2 text-foreground"
                        >
                          <UserIcon className="w-3.5 h-3.5" />
                          <span>View profile & history</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            navigate('/orders');
                          }}
                          className="w-full px-3 py-2 text-[10px] text-left hover:bg-accent/40 flex items-center gap-2 text-foreground"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>My current orders</span>
                        </button>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="w-full px-3 py-2.5 text-[10px] text-left text-red-500 hover:bg-red-500/5 border-t border-border/40 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs opacity-80 mt-2 text-center">
            Discover Fine Dining with Ease and Comfort
          </p>
        </div>
      </div>

      {/* Notification details / rating / order summary modal */}
      {selectedNotification && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => {
            setSelectedNotification(null);
            setSelectedNotificationOrder(null);
          }}
        >
          <div
            className="w-[90%] max-w-sm bg-background rounded-2xl shadow-xl border border-border/60 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with context-aware icon */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
                  {selectedNotification.title === 'Comment Reply' ? (
                    <MessageCircle className="w-4 h-4 text-primary" />
                  ) : selectedNotification.message.includes('Please give us rating for our service.') ? (
                    <span className="text-emerald-400 text-lg">✓</span>
                  ) : selectedNotification.title.toLowerCase().includes('order placed') ||
                    selectedNotification.message.toLowerCase().includes('order has been placed') ? (
                    <span className="text-primary text-lg">🧾</span>
                  ) : (
                    <span className="text-primary text-lg">🔔</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-foreground">
                    {selectedNotification.title}
                  </h2>
                  <div className="text-[9px] text-muted-foreground">
                    {(() => {
                      const d = new Date(selectedNotification.created_at);
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
              <button
                onClick={() => {
                  setSelectedNotification(null);
                  setSelectedNotificationOrder(null);
                  setSelectedBlogPost(null);
                }}
                className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-accent/60"
              >
                Close
              </button>
            </div>

            {/* Blog Post Header for Comment Reply notifications */}
            {selectedNotification.title === 'Comment Reply' && selectedBlogPost && (
              <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
                <div className="flex items-start gap-2">
                  {selectedBlogPost.restaurants?.image_url ? (
                    <img
                      src={selectedBlogPost.restaurants.image_url}
                      alt={selectedBlogPost.restaurants.name}
                      className="w-10 h-10 rounded-lg object-cover border border-border/40"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary via-primary/60 to-amber-400 flex items-center justify-center text-white text-xs font-semibold border border-border/40">
                      {selectedBlogPost.restaurants?.name?.charAt(0) || 'R'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-foreground">
                      {selectedBlogPost.restaurants?.name || 'Restaurant'}
                    </div>
                    <h3 className="text-[11px] font-bold text-foreground leading-tight mt-0.5 line-clamp-2">
                      {selectedBlogPost.title}
                    </h3>
                    <div className="text-[8px] text-muted-foreground mt-1">
                      {new Date(selectedBlogPost.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Primary message */}
            <div className="mt-1 text-[10px] leading-relaxed text-foreground whitespace-pre-line">
              {selectedNotification.message}
            </div>

            {/* Enhanced Reply Content for Blog Comment Replies */}
            {selectedNotification.title === 'Comment Reply' && selectedNotification.reply_content && (
              <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-300 to-emerald-500 flex items-center justify-center text-white text-[8px] font-semibold border border-emerald-300/70">
                    {selectedNotification.restaurant_name?.charAt(0) || 'R'}
                  </div>
                  <div className="text-[9px] font-semibold text-foreground">
                    {selectedNotification.restaurant_name || 'Restaurant Team'} replied:
                  </div>
                </div>
                <div className="bg-muted/40 rounded-xl p-2.5 border border-border/30">
                  <p className="text-[10px] text-foreground leading-relaxed">
                    {selectedNotification.reply_content}
                  </p>
                </div>
                <div className="text-[8px] text-muted-foreground text-right">
                  {(() => {
                    const d = new Date(selectedNotification.created_at);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    let hours = d.getHours();
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12 || 12;
                    return `Replied on ${day}/${month}/${year} at ${hours}:${minutes} ${ampm}`;
                  })()}
                </div>
              </div>
            )}

            {/* If this is an "order placed" style notification, show a rich order summary */}
            {selectedNotification.order_id &&
              !selectedNotification.message.includes('Please give us rating for our service.') && (
                <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold text-foreground">
                      Order Summary
                    </div>
                    <div className="text-[8px] text-primary">
                      Live booking confirmed
                    </div>
                  </div>

                  {selectedNotificationOrder ? (
                    <div className="space-y-2">
                      {/* Restaurant info */}
                      <div className="flex items-start gap-2">
                        <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden">
                          {selectedNotificationOrder.restaurants?.image_url ? (
                            <img
                              src={selectedNotificationOrder.restaurants.image_url}
                              alt={selectedNotificationOrder.restaurants.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">
                              {selectedNotificationOrder.restaurants?.name
                                ?.charAt(0)
                                ?.toUpperCase() || 'R'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-semibold text-foreground">
                            {selectedNotificationOrder.restaurants?.name || 'Your Restaurant'}
                          </div>
                          <div className="text-[8px] text-muted-foreground line-clamp-2">
                            {selectedNotificationOrder.restaurants?.address}
                          </div>
                          <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-primary/5 text-[8px] text-primary border border-primary/20">
                            <span className="text-[9px]">🧾</span>
                            <span className="capitalize">
                              {selectedNotificationOrder.order_type?.replace('_', ' ') || 'dine in'}
                            </span>
                            <span className="mx-1 text-[7px] text-muted-foreground">•</span>
                            <span className="capitalize text-[8px]">
                              {selectedNotificationOrder.status || 'paid'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      {Array.isArray(selectedNotificationOrder.order_items) &&
                        selectedNotificationOrder.order_items.length > 0 && (
                          <div className="bg-muted/40 rounded-xl px-2 py-2 space-y-1">
                            {selectedNotificationOrder.order_items.slice(0, 3).map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center text-[8px] text-muted-foreground"
                              >
                                <span>
                                  {item.quantity}× {item.name}
                                </span>
                                {item.price && (
                                  <span className="text-[8px]">
                                    {(item.price * item.quantity).toLocaleString()} MMK
                                  </span>
                                )}
                              </div>
                            ))}
                            {selectedNotificationOrder.order_items.length > 3 && (
                              <div className="text-[7px] text-muted-foreground/80">
                                + {selectedNotificationOrder.order_items.length - 3} more item(s)
                              </div>
                            )}
                          </div>
                        )}

                      {/* Total */}
                      <div className="flex justify-between items-center pt-1 border-t border-border/40 mt-1">
                        <div className="text-[8px] text-muted-foreground">
                          Total Paid
                        </div>
                        <div className="text-[11px] font-semibold text-primary">
                          {Number(
                            selectedNotificationOrder.total_amount || 0
                          ).toLocaleString()}{' '}
                          MMK
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[8px] text-muted-foreground">
                      Loading your order summary...
                    </div>
                  )}
                </div>
              )}

            {/* Enhanced rating UI for completion/served prompt */}
            {selectedNotification.message.includes('Please give us rating for our service.') && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <div className="flex flex-col items-center gap-1 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center shadow-sm">
                    <span className="text-emerald-400 text-xl">✓</span>
                  </div>
                  <div className="text-[11px] font-semibold text-foreground">
                    Thank you for dining with us
                  </div>
                  <div className="text-[9px] text-muted-foreground text-center">
                    Rate your experience to help us refine our luxury service.
                  </div>
                </div>

                <StarRating />
                <div className="mt-2 text-[8px] text-center text-muted-foreground">
                  Your feedback updates this restaurant's rating in real time for all customers.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Welcome + Search + Circular Gallery + Restaurant List */}
      <div className="max-w-md mx-auto px-6 py-6 space-y-4">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">
            {getGreeting()},{' '}
            <span className="font-bold text-yellow-500">{displayName}</span>
          </h2>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search restaurants or cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Circular top restaurants gallery */}
        {!loading && filteredRestaurants.length > 0 && (
          <CircularRestaurantGallery
            restaurants={[...filteredRestaurants]
              .sort((a, b) => (b.rating || 0) - (a.rating || 0))
              .slice(0, 10)
              .map((r) => ({
                id: r.id,
                image: r.image_url,
                title: r.name,
              }))}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No restaurants found
          </div>
        ) : (
          filteredRestaurants.map((restaurant) => (
            <Card
              key={restaurant.id}
              className="overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
              onClick={() => navigate(`/restaurant/${restaurant.id}`)}
            >
              <div className="relative h-48">
                <img
                  src={restaurant.image_url}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary text-primary-foreground border-0">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    {restaurant.rating}
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground">
                      {restaurant.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {restaurant.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {restaurant.cuisine_type}
                  </Badge>
                  <div className="flex items-center gap-1 text-[0.625rem]">
                    <MapPin className="h-3 w-3" />
                    {restaurant.address}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

/**
 * StarRating component (inline) used in the rating notification modal.
 * - 5 stars
 * - 0.5 increments using hover position (mouse only, touch gets nearest step)
 * - Outline by default, luxury gold fill on hover/selection
 */
const StarRating = () => {
  const [hoverValue, setHoverValue] = useState<number | null>(null); // 0 - 5, with 0.5 steps
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Map a 0-5 value to label (optional, subtle)
  const getLabel = (value: number | null) => {
    if (!value) return 'Tap or hover to rate';
    if (value <= 1.5) return 'Very Bad';
    if (value <= 2.5) return 'Needs Improvement';
    if (value <= 3.5) return 'Good';
    if (value <= 4.5) return 'Very Good';
    return 'Excellent';
  };

  const handleSubmit = async (value: number) => {
    if (submitting || value <= 0) return;
    setSubmitting(true);
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error('Please sign in to rate');
        return;
      }

      // We rely on the currently opened notification in closure via selectedNotification
      // The parent component passes context implicitly: we read the latest selectedNotification from state.
      // To keep it robust, we re-fetch its order_id if needed.
      const notifId = (window as any).__alan_activeRatingNotificationId as string | undefined;
      const notifOrderId = (window as any).__alan_activeRatingNotificationOrderId as string | undefined;

      let orderId = notifOrderId || null;
      if (!notifId && !orderId) {
        toast.error('Unable to link rating to order');
        return;
      }

      if (!orderId && notifId) {
        const { data: notifData, error: notifError } = await supabase
          .from('customer_notifications')
          .select('order_id')
          .eq('id', notifId)
          .single();
        if (notifError || !notifData?.order_id) {
          toast.error('Unable to link rating to order');
          return;
        }
        orderId = notifData.order_id;
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, restaurant_id')
        .eq('id', orderId)
        .single();

      if (orderError || !orderData?.restaurant_id) {
        toast.error('Unable to resolve restaurant for rating');
        return;
      }

      // Persist rating with 0.5 precision; DB numeric(2,1) will store e.g. 3.5
      const { error: ratingError } = await supabase.from('restaurant_ratings').upsert(
        {
          restaurant_id: orderData.restaurant_id,
          customer_id: currentUser.id,
          order_id: orderData.id,
          rating: value,
        },
        { onConflict: 'restaurant_id,customer_id,order_id' }
      );

      if (ratingError) {
        console.error('Failed to save rating', ratingError);
        toast.error('Failed to submit rating');
        return;
      }

      // Mark notification as read if we know it
      if (notifId) {
        await supabase
          .from('customer_notifications')
          .update({ status: 'read' })
          .eq('id', notifId);
      }

      toast.success('Thank you for your rating!');
      setCurrentValue(value);
      // Trigger restaurant list refresh so averaged rating updates
      // We dispatch a custom event that Home listens to via fetchRestaurants
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alanRefreshRestaurants'));
      }
    } catch (err) {
      console.error('Error while submitting rating', err);
      toast.error('Something went wrong while submitting rating');
    } finally {
      setSubmitting(false);
    }
  };

  const effective = hoverValue ?? currentValue ?? 0;

  // Utility to render one star with half-fill support
  const renderStar = (index: number) => {
    const baseValue = index + 1; // star # (1..5)
    const leftHalfValue = baseValue - 0.5;

    const full = effective >= baseValue;
    const half = !full && effective >= leftHalfValue;

    return (
      <div
        key={baseValue}
        className="relative w-7 h-7 cursor-pointer"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const halfStep = x < rect.width / 2 ? 0.5 : 1;
          setHoverValue(baseValue - (halfStep === 0.5 ? 0.5 : 0));
        }}
        onMouseLeave={() => setHoverValue(null)}
        onClick={() => handleSubmit(effective || baseValue)}
        onTouchStart={() => {
          // Touch: simpler behavior, tap cycles nearest whole star
          const next = baseValue;
          setHoverValue(next);
          handleSubmit(next);
        }}
      >
        {/* Outline star (base) */}
        <StarIcon className="w-7 h-7 text-yellow-500/40" />

        {/* Filled portion (full or half) */}
        {(full || half) && (
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{
              width: full ? '100%' : '50%',
            }}
          >
            <StarIcon className="w-7 h-7 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,250,210,0.9)]" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map(renderStar)}
      </div>
      <div className="text-[8px] text-emerald-400 font-medium mt-0.5">
        {getLabel(effective)}
      </div>
      {submitting && (
        <div className="text-[7px] text-muted-foreground mt-0.5">
          Submitting your rating...
        </div>
      )}
    </div>
  );
};

export default Home;
