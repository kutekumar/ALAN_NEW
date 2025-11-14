import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  BookOpenText,
  Plus,
  Image as ImageIcon,
  Trash2,
  Edit2,
  Pin,
  PinOff,
  Calendar,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RestaurantBlogPostDetail } from "./RestaurantBlogPostDetail";

type MenuItem = {
  id: string;
  name: string;
  image_url: string | null;
  price?: number | null;
};

type BlogPost = {
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
};


const RestaurantBlogManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  // Derive hero suggestions: from menu items that have an image
  const heroSuggestions = useMemo(
    () => menuItems.filter((m) => m.image_url),
    [menuItems]
  );

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setLoadingInitial(false);
        return;
      }

      // 1) Try get restaurant_id from profiles if it exists (non-breaking).
      let restaurantIdFromProfile: string | null = null;
      try {
        const { data: ownerProfile, error: ownerError } = await supabase
          .from("profiles")
          .select("restaurant_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!ownerError && ownerProfile && ownerProfile.restaurant_id) {
          restaurantIdFromProfile = ownerProfile.restaurant_id as string;
        }
      } catch (e) {
        console.warn("profiles.restaurant_id lookup skipped or failed", e);
      }

      // 2) If not found, resolve via restaurants.owner_id (matches common pattern in this app).
      let resolvedRestaurantId = restaurantIdFromProfile;
      if (!resolvedRestaurantId) {
        try {
          const { data: restaurantRow, error: restaurantError } = await supabase
            .from("restaurants")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle();

          if (!restaurantError && restaurantRow?.id) {
            resolvedRestaurantId = restaurantRow.id as string;
          }
        } catch (e) {
          console.warn("restaurants.owner_id lookup failed", e);
        }
      }

      if (!resolvedRestaurantId) {
        console.warn(
          "No restaurant associated with this owner. Ensure either profiles.restaurant_id or restaurants.owner_id is set."
        );
        setLoadingInitial(false);
        return;
      }

      setRestaurantId(resolvedRestaurantId);

      await Promise.all([
        loadMenuItems(resolvedRestaurantId),
        loadPosts(resolvedRestaurantId),
      ]);

      setLoadingInitial(false);
    };

    void init();
  }, [user]);

  // Check for view parameter in URL to automatically select a post
  useEffect(() => {
    if (posts.length > 0) {
      const params = new URLSearchParams(location.search);
      const viewPostId = params.get('view');
      
      if (viewPostId) {
        const postToView = posts.find(post => post.id === viewPostId);
        if (postToView) {
          setSelectedPost(postToView);
          // Clear the view parameter from URL to prevent re-selection on refresh
          navigate('/dashboard?tab=blog', { replace: true });
        }
      }
    }
  }, [posts, location.search, navigate]);

  const loadMenuItems = async (rId: string) => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, image_url, price")
      .eq("restaurant_id", rId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading menu items", error);
      return;
    }

    setMenuItems((data as MenuItem[]) || []);
  };

  const loadPosts = async (rId: string) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("restaurant_id", rId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading blog posts", error);
      return;
    }

    const postsData = (data as BlogPost[]) || [];

    // Fetch linked menu items per post via blog_post_menu_items
    if (postsData.length > 0) {
      const ids = postsData.map((p) => p.id);
      const { data: links, error: linksError } = await supabase
        .from("blog_post_menu_items")
        .select("blog_post_id, menu_item_id")
        .in("blog_post_id", ids);

      if (linksError) {
        console.error("Error loading blog_post_menu_items", linksError);
        setPosts(postsData);
        return;
      }

      const linkByPost: Record<string, string[]> = {};
      (links || []).forEach((l: any) => {
        if (!linkByPost[l.blog_post_id]) linkByPost[l.blog_post_id] = [];
        linkByPost[l.blog_post_id].push(l.menu_item_id);
      });

      const menuMap: Record<string, MenuItem> = {};
      menuItems.forEach((m) => {
        menuMap[m.id] = m;
      });

      const enriched = postsData.map((p) => {
        const linkedIds = linkByPost[p.id] || [];
        return {
          ...p,
          linked_menu_items: linkedIds
            .map((id) => menuMap[id])
            .filter(Boolean) as MenuItem[],
        };
      });

      setPosts(enriched);
    } else {
      setPosts([]);
    }
  };

  const openCreate = () => {
    navigate("/dashboard/blog/new");
  };

  const openEdit = (post: BlogPost) => {
    navigate(`/dashboard/blog/edit/${post.id}`);
  };

  const handleTogglePin = async (post: BlogPost) => {
    if (!restaurantId) return;
    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ is_pinned: !post.is_pinned })
        .eq("id", post.id)
        .eq("restaurant_id", restaurantId);

      if (error) throw error;

      // Refresh but keep elegant optimistic UI
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, is_pinned: !p.is_pinned } : p
        )
      );
    } catch (err) {
      console.error("Failed to toggle pin", err);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!restaurantId) return;
    setDeletingId(postId);
    try {
      const { error } = await supabase
        .from("blog_posts")
        .delete()
        .eq("id", postId)
        .eq("restaurant_id", restaurantId);

      if (error) throw error;

      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error("Failed to delete blog post", err);
    } finally {
      setDeletingId(null);
    }
  };




  if (loadingInitial) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">
            Loading your blog studio...
          </span>
        </div>
        <Card className="p-4 bg-card/80 border-border/40 animate-pulse">
          <div className="h-3 w-24 bg-muted/70 rounded mb-2" />
          <div className="h-3 w-40 bg-muted/60 rounded mb-1" />
          <div className="h-3 w-32 bg-muted/50 rounded" />
        </Card>
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <Card className="p-4 bg-card/80 border-dashed border-border/50">
        <p className="text-xs text-muted-foreground">
          No restaurant is associated with this account yet. Once your restaurant
          profile is connected, you'll be able to publish elegant blog posts
          and promotions here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {selectedPost ? (
        <RestaurantBlogPostDetail
          post={selectedPost}
          onBack={() => setSelectedPost(null)}
          onEdit={(post) => {
            setSelectedPost(null);
            openEdit(post);
          }}
          onDelete={(postId) => {
            setSelectedPost(null);
            handleDelete(postId);
          }}
          onTogglePin={(post) => {
            handleTogglePin(post);
            // Update the selected post if it's still open
            if (selectedPost && selectedPost.id === post.id) {
              setSelectedPost(post);
            }
          }}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2">
                <BookOpenText className="w-4 h-4 text-primary" />
                <span className="text-[10px] uppercase tracking-[0.16em] text-primary/80">
                  Blog & Promotions Studio
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-tight">
                Tell your food story
              </h2>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground max-w-md">
                Create minimalist, elegant posts to highlight your signature dishes,
                seasonal menus, and special offers. Customers read these on the Blog tab.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2 rounded-full bg-primary/90 hover:bg-primary shadow-sm self-start sm:self-auto"
              onClick={openCreate}
            >
              <Plus className="w-3 h-3" />
              <span className="text-[10px] font-medium">New Post</span>
            </Button>
          </div>

          {/* Existing posts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {posts.length === 0 && (
          <Card className="p-4 bg-card/80 border-dashed border-border/60">
            <p className="text-[11px] text-muted-foreground">
              You haven't published any stories yet. Create your first post to
              showcase your restaurant's personality and promotions.
            </p>
          </Card>
        )}

        {posts.map((post) => (
          <Card
            key={post.id}
            className={cn(
              "relative overflow-hidden bg-card/90 border-border/40 group cursor-pointer",
              "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
            )}
            onClick={() => setSelectedPost(post)}
          >
            {post.is_pinned && (
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary via-amber-400 to-primary/70" />
            )}

            <div className="p-3 sm:p-3.5 space-y-2 sm:space-y-2.5">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                      {post.title}
                    </h3>
                    {post.is_published ? (
                      <Badge className="h-4 sm:h-5 px-1.5 sm:px-2 text-[7px] sm:text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">Live</span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="h-4 sm:h-5 px-1.5 sm:px-2 text-[7px] sm:text-[8px] border-muted-foreground/40 text-muted-foreground"
                      >
                        Draft
                      </Badge>
                    )}
                    {post.is_pinned && (
                      <Badge
                        variant="outline"
                        className="h-4 sm:h-5 px-1.5 sm:px-2 text-[7px] sm:text-[8px] border-amber-400/60 text-amber-400 bg-amber-400/5 flex items-center gap-1"
                      >
                        <Pin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">Highlight</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground line-clamp-2">
                    {post.excerpt || post.content.slice(0, 120)}
                  </p>
                  <div className="flex items-center gap-2 text-[7px] sm:text-[8px] text-muted-foreground/80">
                    <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    <span className="mx-1">•</span>
                    <span className="hidden sm:inline">{post.is_published ? "Visible in customer Blog" : "Not visible to customers"}</span>
                    <span className="sm:hidden">{post.is_published ? "Visible" : "Hidden"}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {/* Pin toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleTogglePin(post)}
                        className={cn(
                          "w-6 h-6 sm:w-7 sm:h-7 rounded-full border flex items-center justify-center transition-colors",
                          post.is_pinned
                            ? "bg-amber-400/10 border-amber-400/60 text-amber-400"
                            : "bg-card/80 border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40"
                        )}
                      >
                        {post.is_pinned ? (
                          <Pin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        ) : (
                          <PinOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[9px]">
                      {post.is_pinned
                        ? "Unpin from top of customer blog"
                        : "Pin as highlight on customer blog"}
                    </TooltipContent>
                  </Tooltip>

                  {/* Edit */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => openEdit(post)}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-border/60 bg-card/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        <Edit2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[9px]">
                      Edit post
                    </TooltipContent>
                  </Tooltip>

                  {/* Delete */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deletingId === post.id}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-border/60 bg-card/80 flex items-center justify-center text-destructive/80 hover:bg-destructive/5 hover:border-destructive/40 transition-colors disabled:opacity-60"
                      >
                        {deletingId === post.id ? (
                          <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[9px]">
                      Delete post
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Linked menu preview */}
              {post.linked_menu_items &&
                post.linked_menu_items.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {post.linked_menu_items.map((mi) => (
                      <div
                        key={mi.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/5 border border-primary/15 text-[7px] text-primary/80"
                      >
                        <ImageIcon className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[80px]">
                          {mi.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              {/* Hero thumbnail */}
              {post.hero_image_url && (
                <div className="mt-1 overflow-hidden rounded-lg border border-border/40 bg-muted/40">
                  <img
                    src={post.hero_image_url}
                    alt={post.title}
                    className="w-full h-16 sm:h-20 object-cover transform transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      </>
      )}
    </div>
  );
};

export default RestaurantBlogManagement;