import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RestaurantBlogNotification {
  id: string;
  restaurant_id: string;
  customer_id: string;
  blog_post_id: string;
  comment_id: string;
  title: string;
  message: string;
  status: 'unread' | 'read';
  created_at: string;
  // Enriched fields
  customer_name?: string;
  customer_email?: string;
  blog_title?: string;
  comment_content?: string;
}

interface UseRestaurantBlogNotificationsOptions {
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
 * - Fetch latest blog comment notifications for that restaurant
 * - Subscribe to realtime inserts for new customer comments on blog posts
 * - Expose unread count, list, mark-as-read operations
 */
export function useRestaurantBlogNotifications(options: UseRestaurantBlogNotificationsOptions = {}) {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<RestaurantBlogNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialFetched, setInitialFetched] = useState<boolean>(false);

  const limit = options.limit ?? 50;
  const enableSound = options.enableSound ?? true;

  const playSound = useCallback(() => {
    if (!enableSound) return;

    try {
      const audio = getNotificationAudio();

      // Enhanced sound playback with better error handling
      const attemptPlay = async () => {
        audio.currentTime = 0;
        try {
          await audio.play();
          console.log('🔔 Blog comment notification sound played successfully');
        } catch (error) {
          console.warn('🔇 Blog comment notification sound blocked by autoplay policy:', error);
          // Fallback: try to play after user interaction
          const handleUserInteraction = () => {
            audio.play().catch(() => {
              console.warn('🔇 Blog comment fallback sound playback also failed');
            });
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
          };
          
          document.addEventListener('click', handleUserInteraction);
          document.addEventListener('keydown', handleUserInteraction);
        }
      };

      attemptPlay();
    } catch (error) {
      console.error('❌ Failed to play blog comment notification sound:', error);
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

  // Initial fetch of blog comment notifications once we know restaurant_id
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      if (!restaurantId || initialFetched) return;
      setLoading(true);

      // Fetch blog comment notifications for this restaurant with enriched data
      const { data, error } = await supabase
        .from('blog_comment_notifications')
        .select(`
          *,
          blog_posts!inner (title),
          profiles!left (full_name)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching blog comment notifications:', error);
        setNotifications([]);
      } else {
        const normalized: RestaurantBlogNotification[] = (data || []).map((row: any) => {
          const blogPost = Array.isArray(row.blog_posts) ? row.blog_posts[0] : row.blog_posts || {};
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles || {};
          
          return {
            id: row.id,
            restaurant_id: row.restaurant_id,
            customer_id: row.customer_id,
            blog_post_id: row.blog_post_id,
            comment_id: row.comment_id,
            title: row.title,
            message: row.message,
            status: row.status,
            created_at: row.created_at,
            customer_name: profile?.full_name ?? null,
            blog_title: blogPost?.title ?? null,
            comment_content: row.comment_content ?? null,
          };
        });

        setNotifications(normalized);
      }

      setInitialFetched(true);
      setLoading(false);
    };

    fetchInitialNotifications();
  }, [restaurantId, initialFetched, limit]);

  // Realtime subscription for new blog comment notifications
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`blog-comment-notifications-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'blog_comment_notifications',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          const row: any = payload.new;

          // Enrich notification with blog post and customer details
          const { data: blogPostData } = await supabase
            .from('blog_posts')
            .select('title')
            .eq('id', row.blog_post_id)
            .single();

          let customerName: string | null = null;
          if (row.customer_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', row.customer_id)
              .single();
            customerName = profile?.full_name ?? null;
          }

          const incoming: RestaurantBlogNotification = {
            id: row.id,
            restaurant_id: row.restaurant_id,
            customer_id: row.customer_id,
            blog_post_id: row.blog_post_id,
            comment_id: row.comment_id,
            title: row.title,
            message: row.message,
            status: row.status,
            created_at: row.created_at,
            customer_name: customerName,
            blog_title: blogPostData?.title ?? null,
            comment_content: row.comment_content ?? null,
          };

          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, limit);
          });

          // Play sound for unread notifications immediately
          if (row.status === 'unread') {
            playSound();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`🔔 Subscribed to realtime blog comment notifications for restaurant ${restaurantId}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, limit, playSound]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  // Sort notifications with newest first (unread notifications should appear at the top)
  const sortedNotifications = [...notifications].sort((a, b) => {
    // First sort by unread status (unread first)
    if (a.status !== b.status) {
      return a.status === 'unread' ? -1 : 1;
    }
    // Then sort by creation date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const markAllAsRead = useCallback(async () => {
    if (!restaurantId || notifications.length === 0) return;

    const unreadIds = notifications.filter((n) => n.status === 'unread').map((n) => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('blog_comment_notifications')
      .update({ status: 'read' })
      .in('id', unreadIds);

    if (error) {
      console.error('Failed to mark blog comment notifications as read:', error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, status: 'read' } : n))
    );
  }, [restaurantId, notifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!id) return;
    const { error } = await supabase
      .from('blog_comment_notifications')
      .update({ status: 'read' })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark blog comment notification as read:', error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
    );
  }, []);

  return {
    restaurantId,
    notifications: sortedNotifications,
    unreadCount,
    loading,
    markAllAsRead,
    markAsRead,
  };
}