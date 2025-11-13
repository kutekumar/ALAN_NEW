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
import { MessageCircle, ArrowRight, Sparkles, Clock, ChevronDown } from 'lucide-react';
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
  profiles?: {
    full_name: string | null;
    avatar_url?: string | null;
  };
};

const Blog = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<Record<string, BlogComment[]>>({});
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [expandedContentPostIds, setExpandedContentPostIds] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
      // Fetch published posts with restaurant details and aggregated comments count
      const { data, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          restaurants (
            name,
            image_url
          ),
          comments_count:blog_comments(count)
        `)
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

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

      // After running supabase/config-blog-comments-profiles.sql,
      // blog_comments.customer_id -> profiles.id FK exists and this relationship is valid.
      const { data, error } = await supabase
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
          <Button
            variant="outline"
            size="icon"
            className="rounded-full border-border/70 hover:bg-primary/5"
            onClick={fetchPosts}
          >
            <ArrowRight className="w-4 h-4 rotate-90" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 pt-4 pb-4 space-y-4">
        {loadingPosts && (
          <>
            {renderPostSkeleton()}
            {renderPostSkeleton()}
          </>
        )}

        {!loadingPosts && posts.length === 0 && (
          <Card className="p-6 text-center bg-card/60 backdrop-blur-sm border-dashed border-border/60">
            <p className="text-sm text-muted-foreground">
              No blog posts yet. Restaurants will share their promotions and menu highlights here.
            </p>
          </Card>
        )}

        {!loadingPosts &&
          posts.map((post) => {
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
                    <div className="mt-1 overflow-hidden rounded-xl border border-border/40 bg-muted/40">
                      <img
                        src={post.hero_image_url}
                        alt={post.title}
                        className="w-full h-32 object-cover transform transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}

                  {/* Title + Content (expandable) */}
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground leading-snug">
                      {post.title}
                    </h2>
                    {expandedContentPostIds.has(post.id) ? (
                      <p className="text-[11px] text-muted-foreground font-sans whitespace-pre-line leading-relaxed">
                        {post.content}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground font-sans line-clamp-3 leading-relaxed">
                        {post.excerpt ||
                          post.content
                            .slice(0, 180)
                            .concat(post.content.length > 180 ? '…' : '')}
                      </p>
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
                      postComments.map((c) => {
                        // Prefer real profile name if available
                        const displayName =
                          (c.profiles?.full_name &&
                            c.profiles.full_name.trim()) ||
                          `Guest ${c.customer_id.slice(0, 6).toUpperCase()}`;

                        const initials = displayName
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <div
                            key={c.id}
                            className="flex items-start gap-2 text-[9px] bg-background/60 border border-border/20 rounded-xl px-2 py-1.5"
                          >
                            {/* Luxury-style circular initials badge */}
                            <div className="mt-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 text-[8px] flex items-center justify-center text-slate-900 font-semibold shadow-sm border border-amber-300/70">
                              {initials}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-foreground/90 truncate max-w-[140px]">
                                  {displayName}
                                </span>
                                <span className="text-[7px] text-muted-foreground">
                                  {new Date(c.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-[8px] text-muted-foreground leading-snug">
                                {c.content}
                              </p>
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