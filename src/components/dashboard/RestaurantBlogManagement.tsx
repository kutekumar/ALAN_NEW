import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  BookOpenText,
  Plus,
  Image as ImageIcon,
  Link2,
  Trash2,
  Edit2,
  Pin,
  PinOff,
  Calendar,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

type FormState = {
  id?: string;
  title: string;
  content: string;
  excerpt: string;
  is_published: boolean;
  is_pinned: boolean;
  hero_image_url: string;
  linked_menu_item_ids: string[];
};

const emptyForm: FormState = {
  title: "",
  content: "",
  excerpt: "",
  is_published: true,
  is_pinned: false,
  hero_image_url: "",
  linked_menu_item_ids: [],
};

const RestaurantBlogManagement = () => {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editorOpen, setEditorOpen] = useState(false);

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
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setForm({
      id: post.id,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt || "",
      is_published: post.is_published,
      is_pinned: post.is_pinned,
      hero_image_url: post.hero_image_url || "",
      linked_menu_item_ids:
        post.linked_menu_items?.map((m) => m.id) || [],
    });
    setEditorOpen(true);
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

  const handleSave = async () => {
    if (!restaurantId || !user) return;
    if (!form.title.trim() || !form.content.trim()) return;

    setSaving(true);

    try {
      const payload = {
        restaurant_id: restaurantId,
        author_id: user.id,
        title: form.title.trim(),
        content: form.content.trim(),
        excerpt: form.excerpt.trim()
          ? form.excerpt.trim()
          : form.content.trim().slice(0, 140),
        hero_image_url: form.hero_image_url || null,
        is_published: form.is_published,
        is_pinned: form.is_pinned,
      };

      let postId = form.id;

      if (form.id) {
        // Update
        const { data, error } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", form.id)
          .eq("restaurant_id", restaurantId)
          .select("*")
          .single();

        if (error) throw error;
        postId = data.id;

        // Optimistically update local
        setPosts((prev) =>
          prev.map((p) =>
            p.id === data.id ? { ...p, ...data } : p
          )
        );
      } else {
        // Insert
        const { data, error } = await supabase
          .from("blog_posts")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;
        postId = data.id;

        setPosts((prev) => [
          {
            ...data,
            linked_menu_items: [],
          } as BlogPost,
          ...prev,
        ]);
      }

      // Sync blog_post_menu_items
      if (postId) {
        await syncPostMenuLinks(postId, form.linked_menu_item_ids);
      }

      // Reload posts with full linkage to ensure consistency
      await loadPosts(restaurantId);

      setEditorOpen(false);
      setForm(emptyForm);
    } catch (err) {
      console.error("Failed to save blog post", err);
    } finally {
      setSaving(false);
    }
  };

  const syncPostMenuLinks = async (
    postId: string,
    selectedIds: string[]
  ) => {
    // Get existing links
    const { data: existing, error: existingError } = await supabase
      .from("blog_post_menu_items")
      .select("menu_item_id")
      .eq("blog_post_id", postId);

    if (existingError) {
      console.error("Failed to load existing blog_post_menu_items", existingError);
    }

    const existingIds = new Set(
      (existing || []).map((e: any) => e.menu_item_id as string)
    );
    const selectedSet = new Set(selectedIds);

    const toInsert = selectedIds.filter((id) => !existingIds.has(id));
    const toDelete = Array.from(existingIds).filter(
      (id) => !selectedSet.has(id)
    );

    if (toInsert.length > 0) {
      const rows = toInsert.map((id) => ({
        blog_post_id: postId,
        menu_item_id: id,
      }));
      const { error } = await supabase
        .from("blog_post_menu_items")
        .insert(rows);
      if (error) {
        console.error("Failed to insert blog_post_menu_items", error);
      }
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("blog_post_menu_items")
        .delete()
        .eq("blog_post_id", postId)
        .in("menu_item_id", toDelete);
      if (error) {
        console.error("Failed to delete blog_post_menu_items", error);
      }
    }
  };

  const handleSelectHeroFromMenu = (menuItem: MenuItem) => {
    setForm((prev) => ({
      ...prev,
      hero_image_url: menuItem.image_url || prev.hero_image_url,
    }));
  };

  const toggleMenuItemLink = (id: string) => {
    setForm((prev) => {
      const exists = prev.linked_menu_item_ids.includes(id);
      return {
        ...prev,
        linked_menu_item_ids: exists
          ? prev.linked_menu_item_ids.filter((x) => x !== id)
          : [...prev.linked_menu_item_ids, id],
      };
    });
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
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2">
            <BookOpenText className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-primary/80">
              Blog & Promotions Studio
            </span>
          </div>
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            Tell your food story
          </h2>
          <p className="text-[11px] text-muted-foreground max-w-md">
            Create minimalist, elegant posts to highlight your signature dishes,
            seasonal menus, and special offers. Customers read these on the Blog tab.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 rounded-full bg-primary/90 hover:bg-primary shadow-sm"
          onClick={openCreate}
        >
          <Plus className="w-3 h-3" />
          <span className="text-[10px] font-medium">New Post</span>
        </Button>
      </div>

      {/* Existing posts */}
      <div className="space-y-3">
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
              "relative overflow-hidden bg-card/90 border-border/40 group",
              "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
            )}
          >
            {post.is_pinned && (
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary via-amber-400 to-primary/70" />
            )}

            <div className="p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">
                      {post.title}
                    </h3>
                    {post.is_published ? (
                      <Badge className="h-5 px-2 text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Live
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="h-5 px-2 text-[8px] border-muted-foreground/40 text-muted-foreground"
                      >
                        Draft
                      </Badge>
                    )}
                    {post.is_pinned && (
                      <Badge
                        variant="outline"
                        className="h-5 px-2 text-[8px] border-amber-400/60 text-amber-400 bg-amber-400/5 flex items-center gap-1"
                      >
                        <Pin className="w-3 h-3" />
                        Highlight
                      </Badge>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground line-clamp-2">
                    {post.excerpt || post.content.slice(0, 120)}
                  </p>
                  <div className="flex items-center gap-2 text-[8px] text-muted-foreground/80">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    <span className="mx-1">•</span>
                    <span>{post.is_published ? "Visible in customer Blog" : "Not visible to customers"}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {/* Pin toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleTogglePin(post)}
                        className={cn(
                          "w-7 h-7 rounded-full border flex items-center justify-center transition-colors",
                          post.is_pinned
                            ? "bg-amber-400/10 border-amber-400/60 text-amber-400"
                            : "bg-card/80 border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40"
                        )}
                      >
                        {post.is_pinned ? (
                          <Pin className="w-3 h-3" />
                        ) : (
                          <PinOff className="w-3 h-3" />
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
                        className="w-7 h-7 rounded-full border border-border/60 bg-card/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
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
                        className="w-7 h-7 rounded-full border border-border/60 bg-card/80 flex items-center justify-center text-destructive/80 hover:bg-destructive/5 hover:border-destructive/40 transition-colors disabled:opacity-60"
                      >
                        {deletingId === post.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
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
                    className="w-full h-20 object-cover transform transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Editor Dialog */}
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="max-w-lg w-full bg-card/95 backdrop-blur-xl border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              {form.id ? "Edit Blog Post" : "Create New Blog Post"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-[9px] text-muted-foreground">
                Title
              </label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="E.g. Weekend Tasting Menu • Limited Seats"
                className="h-8 text-[10px] bg-background/70 border-border/50"
              />
            </div>

            {/* Excerpt */}
            <div className="space-y-1">
              <label className="text-[9px] text-muted-foreground">
                Short preview (optional)
              </label>
              <Input
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
                placeholder="A one-line teaser that appears in the customer blog listing."
                className="h-8 text-[9px] bg-background/70 border-border/40"
              />
            </div>

            {/* Content */}
            <div className="space-y-1">
              <label className="text-[9px] text-muted-foreground">
                Story & details
              </label>
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                placeholder="Describe your promotion, new menu, chef’s story, or dining experience in a clean, friendly tone..."
                className="min-h-[90px] text-[9px] leading-relaxed bg-background/70 border-border/40 resize-y"
              />
            </div>

            {/* Hero image from existing menu items */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3 text-primary/80" />
                  Hero image (from your menu)
                </label>
                {form.hero_image_url && (
                  <button
                    onClick={() =>
                      setForm((f) => ({ ...f, hero_image_url: "" }))
                    }
                    className="text-[8px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {form.hero_image_url && (
                <div className="overflow-hidden rounded-lg border border-primary/25 bg-muted/40 mb-1.5">
                  <img
                    src={form.hero_image_url}
                    alt="Selected hero"
                    className="w-full h-20 object-cover"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {heroSuggestions.length === 0 && (
                  <p className="text-[8px] text-muted-foreground">
                    Add images to your menu items to see quick hero suggestions here.
                  </p>
                )}
                {heroSuggestions.map((mi) => (
                  <button
                    key={mi.id}
                    type="button"
                    onClick={() => handleSelectHeroFromMenu(mi)}
                    className={cn(
                      "relative border rounded-md overflow-hidden",
                      "border-border/40 hover:border-primary/50 transition-colors",
                      "w-16 h-10 bg-muted/40"
                    )}
                  >
                    {mi.image_url ? (
                      <img
                        src={mi.image_url}
                        alt={mi.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[7px] text-muted-foreground px-1">
                        {mi.name}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent">
                      <span className="block text-[6px] text-white px-1 truncate">
                        {mi.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Link specific menu items */}
            <div className="space-y-1.5">
              <label className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                <Link2 className="w-3 h-3 text-primary/80" />
                Attach featured menu items (optional)
              </label>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {menuItems.length === 0 && (
                  <p className="text-[8px] text-muted-foreground">
                    No menu items found. Create menu items first to link them here.
                  </p>
                )}
                {menuItems.map((mi) => {
                  const active = form.linked_menu_item_ids.includes(mi.id);
                  return (
                    <button
                      key={mi.id}
                      type="button"
                      onClick={() => toggleMenuItemLink(mi.id)}
                      className={cn(
                        "px-1.5 py-0.5 rounded-full border text-[7px] flex items-center gap-1",
                        active
                          ? "bg-primary/10 border-primary/50 text-primary"
                          : "bg-background/60 border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40"
                      )}
                    >
                      {mi.image_url && (
                        <span className="w-3 h-3 rounded-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${mi.image_url})` }}
                        />
                      )}
                      <span className="truncate max-w-[80px]">
                        {mi.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flags */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="w-3 h-3 accent-primary"
                    checked={form.is_published}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        is_published: e.target.checked,
                      }))
                    }
                  />
                  <span>Publish to customer Blog</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="w-3 h-3 accent-primary"
                    checked={form.is_pinned}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        is_pinned: e.target.checked,
                      }))
                    }
                  />
                  <span>Mark as highlight</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-3 text-[9px]"
                onClick={() => {
                  setEditorOpen(false);
                  setForm(emptyForm);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-3 text-[9px] rounded-full bg-primary/90 hover:bg-primary shadow-sm inline-flex items-center gap-1.5"
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.title.trim() ||
                  !form.content.trim()
                }
              >
                {saving && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {form.id ? "Save changes" : "Publish post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RestaurantBlogManagement;