import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CustomerNotification {
  id: string;
  customer_id: string;
  order_id: string | null;
  title: string;
  message: string;
  status: 'unread' | 'read';
  created_at: string;
  // Blog-specific fields
  blog_post_id?: string;
  blog_title?: string;
  is_blog_reply?: boolean;
}

interface UseCustomerNotificationsOptions {
  /**
   * Maximum notifications to keep in memory for dropdown/history.
   * Default: 20
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
 * Hook used in Customer Dashboard to:
 * - Fetch latest notifications from customer_notifications
 * - Subscribe to realtime inserts for the current user
 * - Expose unread count, list, mark-as-read operations
 * - Handle blog comment reply notifications with direct linking
 */
export function useCustomerNotifications(options: UseCustomerNotificationsOptions = {}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialFetched, setInitialFetched] = useState<boolean>(false);

  const limit = options.limit ?? 20;
  const enableSound = options.enableSound ?? true;

  const playSound = useCallback(() => {
    if (!enableSound) return;

    try {
      const audio = getNotificationAudio();

      // Attempt to play sound with better error handling
      const attemptPlay = async () => {
        audio.currentTime = 0;
        try {
          await audio.play();
          console.log('🔔 Notification sound played successfully');
        } catch (error) {
          console.warn('🔇 Notification sound blocked by autoplay policy:', error);
          // Fallback: try to play after user interaction
          const handleUserInteraction = () => {
            audio.play().catch(() => {
              console.warn('🔇 Fallback sound playback also failed');
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
      console.error('❌ Failed to play notification sound:', error);
    }
  }, [enableSound]);

  // Initial fetch of notifications
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      if (!user || initialFetched) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('customer_notifications')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching customer_notifications:', error);
        setNotifications([]);
      } else {
        // Enhance notifications with blog post information
        const enhancedNotifications = await Promise.all(
          (data || []).map(async (notification: any) => {
            const enhanced = { ...notification } as CustomerNotification;
            
            // Check if this is a blog comment reply notification
            if (notification.title === 'Comment Reply' && notification.message) {
              enhanced.is_blog_reply = true;
              
              // Try to extract blog post ID from the message or find it indirectly
              // For now, we'll mark it as a blog reply
              enhanced.blog_title = extractBlogTitleFromMessage(notification.message);
            }
            
            return enhanced;
          })
        );

        setNotifications(enhancedNotifications);
      }

      setInitialFetched(true);
      setLoading(false);
    };

    fetchInitialNotifications();
  }, [user, initialFetched, limit]);

  // Realtime subscription for new notifications with sound
  useEffect(() => {
    if (!user) return;

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
        async (payload) => {
          const row: any = payload.new;

          // Enhance the notification
          const enhancedNotification: CustomerNotification = {
            ...row,
            is_blog_reply: row.title === 'Comment Reply',
            blog_title: row.title === 'Comment Reply' ? extractBlogTitleFromMessage(row.message) : undefined,
          };

          setNotifications((prev) => {
            if (prev.some((n) => n.id === enhancedNotification.id)) return prev;
            return [enhancedNotification, ...prev].slice(0, limit);
          });

          // Play sound for unread notifications
          if (row.status === 'unread') {
            playSound();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`🔔 Subscribed to realtime customer_notifications for user ${user.id}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, limit, playSound]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  const markAllAsRead = useCallback(async () => {
    if (!user || notifications.length === 0) return;

    const unreadIds = notifications.filter((n) => n.status === 'unread').map((n) => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('customer_notifications')
      .update({ status: 'read' })
      .in('id', unreadIds);

    if (error) {
      console.error('Failed to mark notifications as read:', error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, status: 'read' } : n))
    );
  }, [user, notifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!id) return;
    const { error } = await supabase
      .from('customer_notifications')
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
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    markAsRead,
  };
}

/**
 * Helper function to extract blog title from notification message
 * This parses the message to identify if it's about a specific blog post
 */
function extractBlogTitleFromMessage(message: string): string | undefined {
  // Look for patterns like "replied to your comment on 'Blog Title'"
  const match = message.match(/on ["']([^"']+)["']/);
  if (match && match[1]) {
    return match[1];
  }
  
  // If we can't extract the title, return undefined
  return undefined;
}