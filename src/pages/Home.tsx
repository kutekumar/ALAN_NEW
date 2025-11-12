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
    { id: string; title: string; message: string; status: 'unread' | 'read'; created_at: string }[]
  >([]);
  const [selectedNotification, setSelectedNotification] = useState<{
    id: string;
    title: string;
    message: string;
    created_at: string;
  } | null>(null);
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
      .select('id, title, message, status, created_at')
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
        title: string;
        message: string;
        status: 'unread' | 'read';
        created_at: string;
      }[]
    );
  };

  // Initial notifications load + realtime subscription
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
        (payload: any) => {
          const row = payload.new;
          const incoming = {
            id: row.id,
            title: row.title,
            message: row.message,
            status: row.status as 'unread' | 'read',
            created_at: row.created_at,
          };
          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, 20);
          });
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
    title: string;
    message: string;
    status: 'unread' | 'read';
    created_at: string;
  }) => {
    setSelectedNotification(n);
    setShowNotifications(false);

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

      {/* Notification details modal */}
      {selectedNotification && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="w-[90%] max-w-sm bg-background rounded-2xl shadow-xl border border-border/60 p-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {selectedNotification.title}
              </h2>
              <button
                onClick={() => setSelectedNotification(null)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-accent/60"
              >
                Close
              </button>
            </div>
            <div className="text-[9px] text-muted-foreground/80 text-right">
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
            <div className="mt-1 text-[10px] leading-relaxed text-foreground whitespace-pre-line">
              {selectedNotification.message}
            </div>
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
            bend={3}
            textColor="#e5e5e5"
            borderRadius={0.35}
            scrollEase={0.06}
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

export default Home;
