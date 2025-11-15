import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/BottomNav';
import { MessageCircle, ArrowRight, Sparkles, Clock, ChevronDown, User as UserIcon, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useCustomerLoyalty } from '@/hooks/useCustomerLoyalty';
import { cn } from '@/lib/utils';

type BlogPost = {
  id: string;
  restaurant_id: string;
  author_id: string;
  title: string;
  excerpt: string | null;
  content: string;
  hero_image_url: string | null;
  is_published: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  restaurants?: {
    name: string | null;
    image_url: string | null;
  };
  comments_count?: number;
};

type BlogComment = {
  id: string;
  blog_post_id: string;
  customer_id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  parent_comment_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  avatar_url?: string | null;
  display_name?: string;
};

const Blog = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { loading: loyaltyLoading, summary, badgeLabel, badgeIcon } = useCustomerLoyalty();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<Record<string, BlogComment[]>>({});
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [expandedContentPostIds, setExpandedContentPostIds] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'restaurant'>('newest');
  const [showFilters, setShowFilters] = useState(false);
  

  useEffect(() => {
    const init = async () => {
      const { data: authData, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error getting current user for blog comments:', error);
      }
      setCurrentUserId(authData?.user?.id ?? null);
      await fetchPosts();
    };
    void init();
  }, []);
const fetchPosts = async () => {
  try {
    setLoadingPosts(true);
    
    // Build the base query
    let query = supabase
      .from('blog_posts')
      .select(`
        *,
        restaurants (
          name,
          image_url
        ),
        comments_count:blog_comments(count)
      `)
      .eq('is_published', true);

    // Apply search filter
    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery.trim()}%`);
    }

    // Apply restaurant filter
    if (selectedRestaurant) {
      query = query.eq('restaurant_id', selectedRestaurant);
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        query = query.order('is_pinned', { ascending: false })
                 .order('created_at', { ascending: true });
        break;
      case 'restaurant':
        query = query.order('is_pinned', { ascending: false })
                 .order('restaurants.name', { ascending: true })
                 .order('created_at', { ascending: false });
        break;
      default:
        query = query.order('is_pinned', { ascending: false })
                 .order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading blog posts', error);
      setPosts([]);
      return;
    }

    // Normalize comments_count from the aggregated nested response into a flat number
    const normalized =
      (data as any[] | null)?.map((row) => ({
          ...row,
          comments_count:
            Array.isArray(row.comments_count) &&
            row.comments_count.length > 0 &&
            typeof row.comments_count[0]?.count === 'number'
              ? row.comments_count[0].count
              : 0,
        })) || [];

      setPosts(normalized as BlogPost[]);
    } catch (err) {
      console.error('Unexpected error loading blog posts', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Fetch unique restaurants for filter dropdown
  const [restaurants, setRestaurants] = useState<Array<{id: string, name: string}>>([]);
  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading restaurants', error);
        return;
      }

      setRestaurants(data || []);
    } catch (err) {
      console.error('Unexpected error loading restaurants', err);
    }
  };

  // Filtered and sorted posts for display
  const filteredPosts = posts.filter(post => {
    // Search filter
    if (searchQuery.trim() && !post.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Restaurant filter
    if (selectedRestaurant && post.restaurant_id !== selectedRestaurant) {
      return false;
    }
    
    return true;
  });

  // Sort posts based on selected criteria
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === 'restaurant') {
      const nameA = a.restaurants?.name?.toLowerCase() || '';
      const nameB = b.restaurants?.name?.toLowerCase() || '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    
    if (sortBy === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    
    // newest (default)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const toggleContentExpand = (postId: string) => {
    setExpandedContentPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const toggleComments = async (postId: string) => {
    const next = new Set(expandedPostIds);
    if (next.has(postId)) {
      next.delete(postId);
      setExpandedPostIds(next);
      return;
    }

    next.add(postId);
    setExpandedPostIds(next);

    if (!comments[postId]) {
      await fetchComments(postId);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }));

      // Use the view that has correct profile data
      let { data, error } = await supabase
        .from('blog_comments_with_profiles')
        .select('*')
        .eq('blog_post_id', postId)
        .order('created_at', { ascending: true });

      // If the view doesn't exist or fails, fall back to the original query
      if (error) {
        console.warn('View query failed, trying original approach:', error);
        const fallbackResult = await supabase
          .from('blog_comments')
          .select(
            `
            *,
            profiles:customer_id (
              full_name
            )
            `
          )
          .eq('blog_post_id', postId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error('Error loading comments', error);
        return;
      }

      const map: Record<string, BlogComment[]> = { ...comments };
      map[postId] = (data as BlogComment[]) || [];
      setComments(map);
    } catch (err) {
      console.error('Unexpected error loading comments', err);
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = (newComment[postId] || '').trim();
    if (!content || !currentUserId) return;

    try {
      setSubmittingComment((prev) => ({ ...prev, [postId]: true }));

      const { data, error } = await supabase
        .from('blog_comments')
        .insert({
          blog_post_id: postId,
          customer_id: currentUserId,
          content
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error adding comment', error);
        return;
      }

      // Force refresh to get proper profile data
      setTimeout(() => {
        fetchComments(postId);
      }, 100); // Small delay to ensure database write is complete
      
      setComments((prev) => {
        const existing = prev[postId] || [];
        return {
          ...prev,
          [postId]: [...existing, data as BlogComment],
        };
      });
      setNewComment((prev) => ({ ...prev, [postId]: '' }));

      // Optimistically bump the comments_count on the matching post
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments_count: (p.comments_count || 0) + 1,
              }
            : p
        )
      );

      if (!expandedPostIds.has(postId)) {
        const next = new Set(expandedPostIds);
        next.add(postId);
        setExpandedPostIds(next);
      }
    } catch (err) {
      console.error('Unexpected error adding comment', err);
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };


  const renderPostSkeleton = () => (
    <Card className="p-4 space-y-3 bg-card/60 backdrop-blur-sm border-border/40 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/70 to-secondary/10 pb-20">
      {/* Top header */}
      <div className="bg-card/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-30">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80">
                Stories from our restaurants
              </p>
            </div>
            <h1 className="text-2xl font-semibold text-foreground leading-tight">
              Food Journal
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Discover promotions, new menus, and behind-the-scenes stories from all our partners.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-border/70 hover:bg-primary/5"
              onClick={() => setShowFilters(!showFilters)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Search and Filter Section */}
        {showFilters && (
          <div className="max-w-md mx-auto px-5 py-4 border-t border-border/40">
            <div className="space-y-3">
              {/* Search Input */}
              <div>
                <input
                  type="text"
                  placeholder="Search blog posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Restaurant Filter */}
              <div>
                <select
                  value={selectedRestaurant}
                  onChange={(e) => setSelectedRestaurant(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">All Restaurants</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Options */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="restaurant">By Restaurant</option>
                </select>
              </div>

              {/* Filter Summary */}
              {(searchQuery.trim() || selectedRestaurant) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Showing {sortedPosts.length} posts</span>
                  {searchQuery.trim() && (
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">
                      Search: "{searchQuery}"
                    </span>
                  )}
                  {selectedRestaurant && (
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                      {restaurants.find(r => r.id === selectedRestaurant)?.name}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRestaurant('');
                      setSortBy('newest');
                    }}
                    className="ml-1 text-primary hover:text-primary/80"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Content */}
      <div className="max-w-md mx-auto px-5 pt-4 pb-4 space-y-4">
        {loadingPosts && (
          <>
            {renderPostSkeleton()}
            {renderPostSkeleton()}
          </>
        )}

        {!loadingPosts && sortedPosts.length === 0 && (
          <Card className="p-6 text-center bg-card/60 backdrop-blur-sm border-dashed border-border/60">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {posts.length === 0
                  ? "No blog posts yet. Restaurants will share their promotions and menu highlights here."
                  : "No blog posts match your current filters."
                }
              </p>
              {searchQuery.trim() || selectedRestaurant ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRestaurant('');
                    setSortBy('newest');
                  }}
                  className="text-primary hover:text-primary/80 text-sm"
                >
                  Clear all filters
                </button>
              ) : null}
            </div>
          </Card>
        )}

        {!loadingPosts &&
          sortedPosts.map((post) => {
            const postComments = comments[post.id] || [];
            const commentsExpanded = expandedPostIds.has(post.id);
            const initials =
              (post.restaurants?.name || 'R')
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

            return (
              <Card
                key={post.id}
                id={`blog-post-${post.id}`}
                className={cn(
                  'group relative overflow-hidden border-border/40 bg-card/90 backdrop-blur-md transition-all duration-300',
                  'hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(15,23,42,0.12)]'
                )}
              >
                {/* Accent bar for pinned / promo */}
                {post.is_pinned && (
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary via-primary/60 to-amber-400" />
                )}

                <div className="p-4 space-y-3">
                  {/* Restaurant + Meta */}
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9 ring-1 ring-primary/15 shadow-sm">
                      {post.restaurants?.image_url && (
                        <AvatarImage
                          src={post.restaurants.image_url}
                          alt={post.restaurants?.name || 'Restaurant'}
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {post.restaurants?.name || 'Featured Restaurant'}
                      </p>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                        {post.is_pinned && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 text-[8px] border-primary/40 text-primary bg-primary/5"
                          >
                            Highlight
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hero image */}
                  {post.hero_image_url && (
                    <div
                      className="mt-1 overflow-hidden rounded-xl border border-border/40 bg-muted/40 cursor-pointer"
                      onClick={() => toggleContentExpand(post.id)}
                    >
                      <img
                        src={post.hero_image_url}
                        alt={post.title}
                        className="w-full h-32 object-cover transform transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}

                  {/* Title + Content (expandable) */}
                  <div
                    className="space-y-1 cursor-pointer"
                    onClick={() => toggleContentExpand(post.id)}
                  >
                    <h2 className="text-base font-semibold text-foreground leading-relaxed">
                      {post.title}
                    </h2>
                    {expandedContentPostIds.has(post.id) ? (
                      <div
                        className="text-[11px] text-muted-foreground font-sans leading-loose"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                      />
                    ) : (
                      <div
                        className="text-[11px] text-muted-foreground font-sans line-clamp-3 leading-loose"
                        dangerouslySetInnerHTML={{
                          __html: post.excerpt ||
                            (post.content.length > 180
                              ? post.content.slice(0, 180) + '…'
                              : post.content)
                        }}
                      />
                    )}
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between pt-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => toggleContentExpand(post.id)}
                        className="inline-flex items-center gap-1 text-[9px] text-primary/90 hover:text-primary underline-offset-2 hover:underline transition-colors"
                      >
                        {expandedContentPostIds.has(post.id)
                          ? 'Show less'
                          : 'Read more'}
                        <ArrowRight
                          className={cn(
                            'w-3 h-3 transition-transform',
                            expandedContentPostIds.has(post.id)
                              ? 'rotate-180'
                              : 'translate-x-0'
                          )}
                        />
                      </button>
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <MessageCircle className="w-3 h-3" />
                        <span>
                          {(() => {
                            const count =
                              typeof post.comments_count === 'number'
                                ? post.comments_count
                                : postComments.length || 0;
                            return `${count} ${count === 1 ? 'comment' : 'comments'}`;
                          })()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[9px] gap-1 text-primary/90 hover:bg-primary/5"
                      onClick={() => toggleComments(post.id)}
                    >
                      {commentsExpanded ? 'Hide feedback' : 'View feedback'}
                      <ChevronDown
                        className={cn(
                          'w-3 h-3 transition-transform',
                          commentsExpanded ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </Button>
                  </div>
                </div>

                {/* Comments section */}
                {commentsExpanded && (
                  <div className="border-t border-border/30 bg-muted/30 px-3 pb-3 pt-2 space-y-2">
                    {loadingComments[post.id] && (
                      <p className="text-[9px] text-muted-foreground">Loading comments…</p>
                    )}

                    {!loadingComments[post.id] && postComments.length === 0 && (
                      <p className="text-[9px] text-muted-foreground">
                        No comments yet. Be the first to share your thoughts.
                      </p>
                    )}

                    {!loadingComments[post.id] &&
                      postComments
                        .filter(c => c.parent_comment_id === null || c.parent_comment_id === undefined)
                        .map((c) => {
                        // Use display_name from the view which handles the logic
                        const displayName = c.display_name || `Guest ${c.customer_id.slice(0, 6).toUpperCase()}`;

                        const initials = displayName
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <div key={c.id} className="space-y-2">
                            {/* Main comment */}
                            <div className="flex items-start gap-2 text-[9px] bg-background/60 border border-border/20 rounded-xl px-2 py-1.5">
                              {/* Luxury-style circular initials badge */}
                              <div className="mt-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 text-[8px] flex items-center justify-center text-slate-900 font-semibold shadow-sm border border-amber-300/70">
                                {initials}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] text-foreground font-medium truncate max-w-[120px]">
                                    {displayName}
                                  </span>
                                  <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                    {new Date(c.created_at).toLocaleDateString('en-US', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit'
                                    })} • {new Date(c.created_at).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </span>
                                </div>
                                <p className="text-[9px] text-foreground leading-snug">
                                  {c.content}
                                </p>
                                
                                {/* Show replies for this comment */}
                                {(() => {
                                  const replies = postComments.filter(reply => reply.parent_comment_id === c.id);
                                  if (replies.length === 0) return null;
                                  
                                  return (
                                    <div className="space-y-1 mt-2 border-l-2 border-border/40 pl-2">
                                      {replies.map((reply) => {
                                        const replyDisplayName =
                                          reply.display_name || `Guest ${reply.customer_id.slice(0, 6).toUpperCase()}`;
                                        
                                        const replyInitials = replyDisplayName
                                          .split(' ')
                                          .map(word => word[0])
                                          .join('')
                                          .slice(0, 2)
                                          .toUpperCase();
                                        
                                        return (
                                          <div key={reply.id} className="flex items-start gap-1 opacity-80">
                                            <div className="mt-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-300 to-emerald-500 text-[7px] flex items-center justify-center text-slate-900 font-semibold shadow-sm border border-emerald-300/70">
                                              {replyInitials}
                                            </div>
                                            <div className="flex-1 space-y-0.5">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[8px] text-foreground font-medium truncate max-w-[100px]">
                                                  {replyDisplayName} (Reply)
                                                </span>
                                                <span className="text-[7px] text-muted-foreground whitespace-nowrap">
                                                  {new Date(reply.created_at).toLocaleDateString('en-US', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: '2-digit'
                                                  })} • {new Date(reply.created_at).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true
                                                  })}
                                                </span>
                                              </div>
                                              <p className="text-[8px] text-foreground leading-snug">
                                                {reply.content}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {/* Add comment */}
                    <div className="pt-1.5">
                      <Textarea
                        placeholder={
                          currentUserId
                            ? 'Add a thoughtful comment about this promotion or menu…'
                            : 'Sign in to leave a comment.'
                        }
                        value={newComment[post.id] || ''}
                        onChange={(e) =>
                          setNewComment((prev) => ({
                            ...prev,
                            [post.id]: e.target.value
                          }))
                        }
                        disabled={!currentUserId || !!submittingComment[post.id]}
                        className="h-14 text-[9px] resize-none border-border/40 bg-background/80 focus-visible:ring-primary/40"
                      />
                      <div className="flex justify-end mt-1 gap-2">
                        {!currentUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[8px] text-muted-foreground"
                            onClick={() => navigate('/auth')}
                          >
                            Sign in to comment
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-6 px-3 text-[8px] rounded-full bg-primary/90 hover:bg-primary shadow-sm"
                          disabled={
                            !currentUserId ||
                            !newComment[post.id]?.trim() ||
                            !!submittingComment[post.id]
                          }
                          onClick={() => handleAddComment(post.id)}
                        >
                          {submittingComment[post.id] ? 'Posting…' : 'Post comment'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
      </div>

      <BottomNav />
    </div>
  );
};

export default Blog;