import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrderNotification {
  id: string;
  order_id: string;
  restaurant_id: string;
  customer_id: string | null;
  title: string;
  message: string;
  status: 'unread' | 'read';
  created_at: string;
  // Enriched for UI
  customer_name?: string | null;
  total_amount?: number | null;
  order_status?: string | null;
}

interface UseOrderNotificationsOptions {
  /**
   * Maximum notifications to keep in memory for dropdown/history.
   * Default: 50
   */
  limit?: number;
  /**
   * Whether to play a sound when new unread notification arrives.
   * Default: true
   */
  enableSound?: boolean;
}

/**
 * Simple in-memory audio loader for notification sound.
 * Uses public/sound/notification.mp3 so it works in production build.
 */
const getNotificationAudio = () => {
  const audio = new Audio('/sound/notification.mp3');
  audio.preload = 'auto';
  return audio;
};

/**
 * Hook used in Restaurant Owner Dashboard to:
 * - Resolve the restaurant owned by current user
 * - Fetch latest notifications from order_notifications
 * - Subscribe to realtime inserts for that restaurant_id
 * - Expose unread count, list, mark-as-read operations
 */
export function useOrderNotifications(options: UseOrderNotificationsOptions = {}) {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialFetched, setInitialFetched] = useState<boolean>(false);

  const limit = options.limit ?? 50;
  const enableSound = options.enableSound ?? true;

  const playSound = useCallback(() => {
    if (!enableSound) return;

    try {
      const audio = getNotificationAudio();

      // If tab is hidden, try to ensure the sound is still attempted.
      // Many browsers allow audio if the user has interacted with the site before.
      const attemptPlay = () => {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Autoplay restrictions: we silently ignore, but owner
          // will still get sound once they interact again.
        });
      };

      // Always attempt play; Page Visibility API is only advisory here.
      attemptPlay();
    } catch {
      // no-op
    }
  }, [enableSound]);

  // Resolve restaurant owned by current user
  useEffect(() => {
    const fetchRestaurantForOwner = async () => {
      if (!user) {
        setRestaurantId(null);
        setNotifications([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (error || !data) {
        console.error('Failed to resolve restaurant for owner:', error);
        setRestaurantId(null);
        setNotifications([]);
        setLoading(false);
        return;
      }

      setRestaurantId(data.id);
      setLoading(false);
    };

    fetchRestaurantForOwner();
  }, [user]);

  // Initial fetch of notifications once we know restaurant_id
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      if (!restaurantId || initialFetched) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('order_notifications')
        .select(
          `
          id,
          order_id,
          restaurant_id,
          customer_id,
          title,
          message,
          status,
          created_at,
          orders!inner (
            total_amount,
            status,
            customer_id
          ),
          profiles!left (
            full_name
          )
        `
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching order_notifications:', error);
        setNotifications([]);
      } else {
        const normalized: OrderNotification[] = (data || []).map((row: any) => {
          const order = Array.isArray(row.orders) ? row.orders[0] : row.orders || {};
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles || {};
          return {
            id: row.id,
            order_id: row.order_id,
            restaurant_id: row.restaurant_id,
            customer_id: row.customer_id,
            title: row.title,
            message: row.message,
            status: row.status,
            created_at: row.created_at,
            customer_name: profile?.full_name ?? null,
            total_amount: order?.total_amount ?? null,
            order_status: order?.status ?? null,
          };
        });

        setNotifications(normalized);
      }

      setInitialFetched(true);
      setLoading(false);
    };

    fetchInitialNotifications();
  }, [restaurantId, initialFetched, limit]);

  // Realtime subscription for new notifications with enrichment + sound
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`order-notifications-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_notifications',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          const row: any = payload.new;

          // Enrich for better UI text
          const { data: orderData } = await supabase
            .from('orders')
            .select('total_amount, status, customer_id')
            .eq('id', row.order_id)
            .single();

          let customerName: string | null = null;
          if (orderData?.customer_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', orderData.customer_id)
              .single();
            customerName = profile?.full_name ?? null;
          }

          const incoming: OrderNotification = {
            id: row.id,
            order_id: row.order_id,
            restaurant_id: row.restaurant_id,
            customer_id: row.customer_id,
            title: row.title,
            message: row.message,
            status: row.status,
            created_at: row.created_at,
            customer_name: customerName,
            total_amount: orderData?.total_amount ?? null,
            order_status: orderData?.status ?? null,
          };

          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, limit);
          });

          playSound();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`🔔 Subscribed to realtime order_notifications for restaurant ${restaurantId}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, limit, playSound]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  const markAllAsRead = useCallback(async () => {
    if (!restaurantId || notifications.length === 0) return;

    const unreadIds = notifications.filter((n) => n.status === 'unread').map((n) => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('order_notifications')
      .update({ status: 'read' })
      .in('id', unreadIds);

    if (error) {
      console.error('Failed to mark notifications as read:', error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, status: 'read' } : n))
    );
  }, [restaurantId, notifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!id) return;
    const { error } = await supabase
      .from('order_notifications')
      .update({ status: 'read' })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
    );
  }, []);

  return {
    restaurantId,
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    markAsRead,
  };
}