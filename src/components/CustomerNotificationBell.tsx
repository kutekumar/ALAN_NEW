import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerNotifications } from '@/hooks/useCustomerNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, MessageCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CustomerNotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    markAsRead,
  } = useCustomerNotifications({
    limit: 10,
    enableSound: true,
  });

  // Track if we've shown the initial notification for blog comment replies
  useEffect(() => {
    if (!loading && !hasInitialized && user) {
      setHasInitialized(true);
    }
  }, [loading, hasInitialized, user]);

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    markAsRead(notification.id);

    // Handle blog comment reply notifications
    if (notification.is_blog_reply) {
      // Navigate to the Blog page
      navigate('/blog');
    } else if (notification.order_id) {
      // Navigate to order details if it's an order notification
      navigate(`/orders/${notification.order_id}`);
    } else {
      // For other notifications, just mark as read
      setDropdownOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    setDropdownOpen(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2 hover:bg-background/50 transition-colors"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-primary" />
        ) : (
          <Bell className="w-5 h-5 text-muted-foreground" />
        )}
        
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs p-0 flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {dropdownOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-2 w-80 bg-card/95 backdrop-blur-xl border border-border/40 rounded-lg shadow-lg z-50">
            {/* Header */}
            <div className="p-3 border-b border-border/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleMarkAllRead}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                      <div className="w-8 h-8 bg-muted rounded-full" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-2 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      className={cn(
                        "w-full text-left p-3 hover:bg-background/30 transition-colors",
                        notification.status === 'unread' ? 'bg-background/20' : 'bg-transparent'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {notification.title}
                          </span>
                          {notification.status === 'unread' && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border/30 text-center">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/blog')}
                >
                  View all blog posts →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};