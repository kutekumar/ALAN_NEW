import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  Calendar,
  MessageCircle,
  CheckCircle2,
  Image as ImageIcon,
  Link2,
  Users,
  Clock,
  Reply
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogComment {
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
}

interface MenuItem {
  id: string;
  name: string;
  image_url: string | null;
  price?: number | null;
}

interface BlogPostDetail {
  id: string;
  restaurant_id: string;
  author_id: string;
  title: string;
  content: string;
  excerpt: string | null;
  hero_image_url: string | null;
  is_published: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  linked_menu_items?: MenuItem[];
  comments_count?: number;
}

interface RestaurantBlogPostDetailProps {
  post: BlogPostDetail;
  onBack: () => void;
  onEdit: (post: BlogPostDetail) => void;
  onDelete: (postId: string) => void;
  onTogglePin: (post: BlogPostDetail) => void;
}

const RestaurantBlogPostDetail = ({
  post,
  onBack,
  onEdit,
  onDelete,
  onTogglePin
}: RestaurantBlogPostDetailProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      
      // Use the view that has correct profile data
      let { data, error } = await supabase
        .from('blog_comments_with_profiles')
        .select('*')
        .eq('blog_post_id', post.id)
        .order('created_at', { ascending: false });

      // If the view doesn't exist or fails, fall back to the original query
      if (error) {
        console.warn('View query failed, trying original approach:', error);
        const fallbackResult = await supabase
          .from('blog_comments')
          .select(`
            *,
            profiles:customer_id (
              full_name
            )
          `)
          .eq('blog_post_id', post.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error('Error loading comments', error);
        return;
      }

      setComments((data as BlogComment[]) || []);
    } catch (err) {
      console.error('Unexpected error loading comments', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      const { error } = await supabase
        .from('blog_comments')
        .update({ is_deleted: true })
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleReplyToComment = async (commentId: string) => {
    const replyContent = replyText[commentId]?.trim();
    if (!replyContent || !user) return;

    try {
      const { data, error } = await supabase
        .from('blog_comments')
        .insert({
          blog_post_id: post.id,
          customer_id: user.id,
          content: replyContent,
          parent_comment_id: commentId
        })
        .select(`
          *,
          profiles:customer_id (
            full_name
          )
        `)
        .single();

      if (error) throw error;

      // Force refresh comments to get updated profile data
      setTimeout(() => {
        fetchComments();
      }, 100); // Small delay to ensure database write is complete
      setReplyText(prev => ({ ...prev, [commentId]: '' }));
      setReplyingTo(null);
      
      // Note: Notification will be automatically triggered by the database trigger
      // No need to manually create notifications - the SQL trigger handles this
    } catch (err) {
      console.error('Failed to reply to comment', err);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/70 to-secondary/10">
      {/* Header */}
      <div className="bg-card/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Posts
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-foreground">Post Details</h1>
              <p className="text-sm text-muted-foreground">Full view with customer feedback</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onEdit(post)}
              >
                <Edit2 className="w-4 h-4" />
                <span className="text-[10px]">Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive/80 border-destructive/20 hover:border-destructive/40"
                onClick={() => onDelete(post.id)}
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-[10px]">Delete</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Post Content Card */}
        <Card className="bg-card/90 backdrop-blur-md border-border/40 overflow-hidden">
          {post.is_pinned && (
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-amber-400 to-primary/70 z-10" />
          )}
          
          <div className="p-6 space-y-4">
            {/* Post Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-foreground">{post.title}</h2>
                  <div className="flex items-center gap-2">
                    {post.is_published ? (
                      <Badge className="h-6 px-3 text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-6 px-3 text-[9px] border-muted-foreground/40 text-muted-foreground">
                        Draft
                      </Badge>
                    )}
                    {post.is_pinned && (
                      <Badge variant="outline" className="h-6 px-3 text-[9px] border-amber-400/60 text-amber-400 bg-amber-400/5 flex items-center gap-1">
                        <Pin className="w-3 h-3" />
                        Highlight
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Created: {new Date(post.created_at).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</span>
                  </div>
                  {post.created_at !== post.updated_at && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Updated: {new Date(post.updated_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                variant={post.is_pinned ? "default" : "outline"}
                size="sm"
                className={cn(
                  "gap-2 rounded-full",
                  post.is_pinned 
                    ? "bg-amber-400/10 border-amber-400/60 text-amber-400 hover:bg-amber-400/15" 
                    : "border-border/40 hover:border-primary/40 text-muted-foreground hover:text-primary"
                )}
                onClick={() => onTogglePin(post)}
              >
                {post.is_pinned ? (
                  <>
                    <PinOff className="w-4 h-4" />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin className="w-4 h-4" />
                    Pin as Highlight
                  </>
                )}
              </Button>
            </div>

            {/* Hero Image */}
            {post.hero_image_url && (
              <div className="mt-4 overflow-hidden rounded-xl border border-border/40 bg-muted/40">
                <img
                  src={post.hero_image_url}
                  alt={post.title}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            {/* Post Content */}
            <div className="prose prose-sm max-w-none">
              <div className="text-[15px] text-foreground leading-relaxed whitespace-pre-line">
                {post.content}
              </div>
            </div>

            {/* Linked Menu Items */}
            {post.linked_menu_items && post.linked_menu_items.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Featured Menu Items</h3>
                    <span className="text-[11px] text-muted-foreground">({post.linked_menu_items.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.linked_menu_items.map((item) => (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-sm text-primary/80"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span className="font-medium">{item.name}</span>
                        {item.price && (
                          <span className="text-primary/60">- {item.price.toLocaleString()} MMK</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Post Stats */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                <span>{comments.length} customer {comments.length === 1 ? 'comment' : 'comments'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>Visible to all customers</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Customer Feedback Section */}
        <Card className="bg-card/90 backdrop-blur-md border-border/40">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Customer Feedback</h3>
              <span className="text-sm text-muted-foreground">({comments.length})</span>
            </div>

            <Separator className="mb-4" />

            {loadingComments ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-background/50 rounded-lg animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No customer feedback yet</p>
                <p className="text-xs mt-1">Comments will appear here once customers start engaging with your post</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-4">
                  {comments
                    .filter(comment => comment.parent_comment_id === null || comment.parent_comment_id === undefined)
                    .map((comment) => {
                      // Use display_name from the view which handles the logic
                      const displayName = comment.display_name || `Guest ${comment.customer_id.slice(0, 6).toUpperCase()}`;
                      
                      const userInitials = getInitials(displayName);
                      
                      // Find replies for this comment
                      const replies = comments.filter(reply => reply.parent_comment_id === comment.id);
                      
                      return (
                        <div key={comment.id} className="space-y-3">
                          {/* Main Comment */}
                          <div className="flex items-start gap-2">
                            {/* Luxury-style circular initials badge */}
                            <div className="mt-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 text-[8px] flex items-center justify-center text-slate-900 font-semibold shadow-sm border border-amber-300/70">
                              {userInitials}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] text-foreground font-medium truncate max-w-[120px]">
                                  {displayName}
                                </span>
                                <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                  {new Date(comment.created_at).toLocaleDateString('en-US', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: '2-digit'
                                  })} • {new Date(comment.created_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                              <p className="text-[9px] text-foreground leading-snug">
                                {comment.content}
                              </p>
                              
                              {/* Replies */}
                              {replies.length > 0 && (
                                <div className="space-y-2 mt-2 border-l-2 border-border/40 pl-3">
                                  {replies.map((reply) => {
                                    const replyDisplayName =
                                      reply.display_name || `Guest ${reply.customer_id.slice(0, 6).toUpperCase()}`;
                                    
                                    const replyInitials = getInitials(replyDisplayName);
                                    
                                    return (
                                      <div key={reply.id} className="flex items-start gap-2 opacity-80">
                                        <div className="mt-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-300 to-emerald-500 text-[7px] flex items-center justify-center text-slate-900 font-semibold shadow-sm border border-emerald-300/70">
                                          {replyInitials}
                                        </div>
                                        <div className="flex-1 space-y-1">
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
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-1 text-[6px] text-destructive hover:text-destructive/80 hover:bg-destructive/5"
                                          onClick={() => handleDeleteComment(reply.id)}
                                          disabled={deletingId === reply.id}
                                          title="Delete reply"
                                        >
                                          {deletingId === reply.id ? (
                                            <Clock className="w-2 h-2 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-2 h-2" />
                                          )}
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-1 text-[7px] text-muted-foreground hover:text-primary hover:bg-primary/5"
                                onClick={() => setReplyingTo(comment.id)}
                                title="Reply to comment"
                              >
                                <Reply className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-1 text-[7px] text-destructive hover:text-destructive/80 hover:bg-destructive/5"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deletingId === comment.id}
                                title="Delete comment"
                              >
                                {deletingId === comment.id ? (
                                  <Clock className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Reply Input */}
                          {replyingTo === comment.id && (
                            <div className="ml-8 flex gap-2">
                              <Textarea
                                placeholder="Write a reply..."
                                value={replyText[comment.id] || ''}
                                onChange={(e) => setReplyText(prev => ({
                                  ...prev,
                                  [comment.id]: e.target.value
                                }))}
                                className="text-[9px] resize-none border-border/40 bg-background/80 focus-visible:ring-primary/40 h-16"
                                rows={2}
                              />
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  className="h-6 px-2 text-[8px] rounded-full bg-primary/90 hover:bg-primary shadow-sm"
                                  onClick={() => handleReplyToComment(comment.id)}
                                  disabled={!replyText[comment.id]?.trim()}
                                >
                                  Send
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[8px] text-muted-foreground"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText(prev => ({ ...prev, [comment.id]: '' }));
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export { RestaurantBlogPostDetail };