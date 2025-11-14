import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./quill-editor.css";
import {
  Sparkles,
  Image as ImageIcon,
  Link2,
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  CheckCircle2,
  X
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

const BlogEditor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const [form, setForm] = useState({
    title: "",
    content: "",
    excerpt: "",
    is_published: true,
    is_pinned: false,
    hero_image_url: "",
    linked_menu_item_ids: [] as string[],
  });

  // Derive hero suggestions: from menu items that have an image
  const heroSuggestions = menuItems.filter((m) => m.image_url);

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Get restaurant ID
      let restaurantIdFromProfile: string | null = null;
      try {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("restaurant_id")
          .eq("id", user.id)
          .maybeSingle();

        if (ownerProfile?.restaurant_id) {
          restaurantIdFromProfile = ownerProfile.restaurant_id as string;
        }
      } catch (e) {
        console.warn("profiles.restaurant_id lookup skipped or failed", e);
      }

      if (!restaurantIdFromProfile) {
        try {
          const { data: restaurantRow } = await supabase
            .from("restaurants")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle();

          if (restaurantRow?.id) {
            restaurantIdFromProfile = restaurantRow.id as string;
          }
        } catch (e) {
          console.warn("restaurants.owner_id lookup failed", e);
        }
      }

      if (!restaurantIdFromProfile) {
        console.warn("No restaurant associated with this owner");
        setLoading(false);
        return;
      }

      setRestaurantId(restaurantIdFromProfile);

      // Load menu items
      const { data: menuData } = await supabase
        .from("menu_items")
        .select("id, name, image_url, price")
        .eq("restaurant_id", restaurantIdFromProfile)
        .order("name", { ascending: true });

      setMenuItems((menuData as MenuItem[]) || []);

      // If editing, load post data
      if (postId) {
        const { data: postData } = await supabase
          .from("blog_posts")
          .select("*")
          .eq("id", postId)
          .single();

        if (postData) {
          setForm({
            title: postData.title,
            content: postData.content,
            excerpt: postData.excerpt || "",
            is_published: postData.is_published,
            is_pinned: postData.is_pinned,
            hero_image_url: postData.hero_image_url || "",
            linked_menu_item_ids: [],
          });

          // Load linked menu items
          const { data: links } = await supabase
            .from("blog_post_menu_items")
            .select("menu_item_id")
            .eq("blog_post_id", postId);

          if (links) {
            setForm(prev => ({
              ...prev,
              linked_menu_item_ids: links.map(l => l.menu_item_id)
            }));
          }
        }
      }

      setLoading(false);
    };

    init();
  }, [user, postId]);

  const handleSave = async () => {
    if (!restaurantId || !user || !form.title.trim() || !form.content.trim()) return;

    setSaving(true);

    try {
      const payload = {
        restaurant_id: restaurantId,
        author_id: user.id,
        title: form.title.trim(),
        content: form.content.trim(),
        excerpt: form.excerpt.trim() || form.content.trim().slice(0, 140),
        hero_image_url: form.hero_image_url || null,
        is_published: form.is_published,
        is_pinned: form.is_pinned,
      };

      let savedPostId = postId;

      if (postId) {
        // Update
        const { data } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", postId)
          .select("*")
          .single();

        savedPostId = data.id;
      } else {
        // Insert
        const { data } = await supabase
          .from("blog_posts")
          .insert(payload)
          .select("*")
          .single();

        savedPostId = data.id;
      }

      // Sync blog_post_menu_items
      if (savedPostId) {
        // Clear existing links
        await supabase
          .from("blog_post_menu_items")
          .delete()
          .eq("blog_post_id", savedPostId);

        // Add new links
        if (form.linked_menu_item_ids.length > 0) {
          const rows = form.linked_menu_item_ids.map(id => ({
            blog_post_id: savedPostId,
            menu_item_id: id,
          }));
          await supabase
            .from("blog_post_menu_items")
            .insert(rows);
        }
      }

      // Navigate back to blog management with specific post if editing
      if (postId) {
        navigate("/dashboard?tab=blog&view=" + postId);
      } else {
        navigate("/dashboard?tab=blog");
      }
    } catch (err) {
      console.error("Failed to save blog post", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectHeroFromMenu = (menuItem: MenuItem) => {
    setForm(prev => ({
      ...prev,
      hero_image_url: menuItem.image_url || prev.hero_image_url,
    }));
  };

  const toggleMenuItemLink = (id: string) => {
    setForm(prev => {
      const exists = prev.linked_menu_item_ids.includes(id);
      return {
        ...prev,
        linked_menu_item_ids: exists
          ? prev.linked_menu_item_ids.filter(x => x !== id)
          : [...prev.linked_menu_item_ids, id],
      };
    });
  };

  const handleImageUrlAdd = () => {
    const input = document.createElement("input");
    input.type = "url";
    input.placeholder = "Enter image URL...";
    input.className = "w-full p-2 border rounded text-sm";
    
    const dialog = document.createElement("div");
    dialog.className = "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
    dialog.innerHTML = `
      <div class="bg-card p-6 rounded-lg border border-border max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Add Image URL</h3>
        <div class="mb-4"></div>
        <div class="flex gap-2 justify-end">
          <button class="px-4 py-2 text-sm border rounded hover:bg-muted" onclick="this.closest('.fixed').remove()">Cancel</button>
          <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90" onclick="this.closest('.fixed').remove()">Add</button>
        </div>
      </div>
    `;
    
    dialog.querySelector("div.mb-4")?.appendChild(input);
    document.body.appendChild(dialog);
    
    const addButton = dialog.querySelector("button:last-child") as HTMLButtonElement;
    addButton.onclick = () => {
      const url = input.value.trim();
      if (url) {
        setForm(prev => ({ ...prev, hero_image_url: url }));
      }
      dialog.remove();
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background/70 to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background/70 to-secondary/10 flex items-center justify-center">
        <Card className="p-6 max-w-md mx-4">
          <p className="text-sm text-muted-foreground text-center">
            No restaurant is associated with this account yet.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/70 to-secondary/10">
      {/* Header */}
      <div className="bg-card/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => {
                  if (postId) {
                    navigate("/dashboard?tab=blog&view=" + postId);
                  } else {
                    navigate("/dashboard?tab=blog");
                  }
                }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (postId) {
                    navigate("/dashboard?tab=blog&view=" + postId);
                  } else {
                    navigate("/dashboard?tab=blog");
                  }
                }}
                className="gap-2 hidden md:flex"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{postId ? "Back to Post" : "Back to Blog"}</span>
              </Button>
              <div className="h-3 md:h-4 w-px bg-border hidden md:block" />
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h1 className="text-base md:text-lg font-semibold">
                  {postId ? "Edit Blog Post" : "Create New Post"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
                className="gap-2 hidden md:flex"
              >
                {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {previewMode ? "Edit" : "Preview"}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden md:inline">{postId ? "Update" : "Publish"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {previewMode ? (
          /* Preview Mode */
          <Card className="bg-card/90 backdrop-blur-md border-border/40 overflow-hidden">
            <div className="p-6 space-y-4">
              {/* Post Header */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-foreground">{form.title || "Untitled Post"}</h2>
                  <div className="flex items-center gap-2">
                    {form.is_published ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                        Draft
                      </Badge>
                    )}
                    {form.is_pinned && (
                      <Badge variant="outline" className="border-amber-400/60 text-amber-400 bg-amber-400/5 flex items-center gap-1">
                        <Pin className="w-3 h-3" />
                        Highlight
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>

              {/* Hero Image */}
              {form.hero_image_url && (
                <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/40">
                  <img
                    src={form.hero_image_url}
                    alt={form.title}
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}

              {/* Post Content */}
              <div className="prose prose-sm max-w-none">
                <div
                  className="text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: form.content || "Your content will appear here..." }}
                />
              </div>

              {/* Auto-generated Excerpt Preview */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border/40">
                <p className="text-sm font-medium text-muted-foreground mb-1">Auto-generated excerpt:</p>
                <p className="text-sm text-foreground">
                  {form.excerpt || form.content.slice(0, 140) + (form.content.length > 140 ? "..." : "")}
                </p>
              </div>

              {/* Linked Menu Items */}
              {form.linked_menu_item_ids.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Featured Menu Items</h3>
                    <span className="text-xs text-muted-foreground">({form.linked_menu_item_ids.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.linked_menu_item_ids.map(id => {
                      const item = menuItems.find(m => m.id === id);
                      return item ? (
                        <div
                          key={id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-sm text-primary/80"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span className="font-medium">{item.name}</span>
                          {item.price && (
                            <span className="text-primary/60">- {item.price.toLocaleString()} MMK</span>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : (
          /* Edit Mode */
          <div className="space-y-4 md:space-y-6">
            {/* Title Section */}
            <Card className="bg-card/90 backdrop-blur-md border-border/40">
              <div className="p-4 md:p-6 space-y-3 md:space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Post Title</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Weekend Tasting Menu • Limited Seats"
                    className="text-base md:text-lg"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary"
                      checked={form.is_published}
                      onChange={(e) => setForm(prev => ({ ...prev, is_published: e.target.checked }))}
                    />
                    <span>Publish to customer Blog</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary"
                      checked={form.is_pinned}
                      onChange={(e) => setForm(prev => ({ ...prev, is_pinned: e.target.checked }))}
                    />
                    <span>Mark as highlight</span>
                  </label>
                </div>
              </div>
            </Card>

            {/* Content Section */}
            <Card className="bg-card/90 backdrop-blur-md border-border/40">
              <div className="p-4 md:p-6 space-y-3 md:space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Story & Details</label>
                  <div className="border-2 border-primary/30 bg-background/80 focus-within:border-primary/50 transition-all duration-200">
                    <ReactQuill
                      theme="snow"
                      value={form.content}
                      onChange={(value) => setForm(prev => ({ ...prev, content: value }))}
                      placeholder="Share your restaurant's story, describe your new menu, highlight special ingredients, or announce upcoming events. Write in a warm, inviting tone that connects with your customers..."
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          ['blockquote', 'code-block'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          [{ 'script': 'sub' }, { 'script': 'super' }],
                          [{ 'indent': '-1' }, { 'indent': '+1' }],
                          [{ 'direction': 'rtl' }],
                          [{ 'size': ['small', false, 'large', 'huge'] }],
                          [{ 'color': [] }, { 'background': [] }],
                          [{ 'font': [] }],
                          [{ 'align': [] }],
                          ['link', 'image', 'video'],
                          ['clean']
                        ],
                        clipboard: {
                          matchVisual: false,
                        }
                      }}
                      formats={[
                        'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
                        'list', 'bullet', 'indent', 'script', 'align', 'size',
                        'color', 'background', 'font', 'link', 'image', 'video'
                      ]}
                    />
                  </div>
                </div>

                {/* Auto-generated Excerpt Preview */}
                <div className="p-3 md:p-4 bg-muted/30 rounded-lg border border-border/40">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Auto-generated excerpt:</p>
                  <p className="text-sm text-foreground">
                    {form.content.replace(/<[^>]*>/g, '').slice(0, 140) + (form.content.replace(/<[^>]*>/g, '').length > 140 ? "..." : "")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    This excerpt will be automatically generated from your content and shown in the blog listing.
                  </p>
                </div>
              </div>
            </Card>

            {/* Hero Image Section */}
            <Card className="bg-card/90 backdrop-blur-md border-border/40">
              <div className="p-4 md:p-6 space-y-3 md:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-medium text-foreground">Header Image</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleImageUrlAdd}
                      className="gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Add URL</span>
                    </Button>
                    {form.hero_image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm(prev => ({ ...prev, hero_image_url: "" }))}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden sm:inline">Clear</span>
                      </Button>
                    )}
                  </div>
                </div>

                {form.hero_image_url && (
                  <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/40">
                    <img
                      src={form.hero_image_url}
                      alt="Header preview"
                      className="w-full h-32 md:h-48 object-cover"
                    />
                  </div>
                )}

                {heroSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Or select from your menu images:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {heroSuggestions.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectHeroFromMenu(item)}
                          className="relative group overflow-hidden rounded border-2 border-transparent hover:border-primary/50 transition-colors"
                        >
                          <img
                            src={item.image_url!}
                            alt={item.name}
                            className="w-full h-12 sm:h-16 object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                            <p className="text-[10px] sm:text-xs text-white truncate">{item.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Menu Items Section */}
            <Card className="bg-card/90 backdrop-blur-md border-border/40">
              <div className="p-4 md:p-6 space-y-3 md:space-y-4">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium text-foreground">Featured Menu Items</h3>
                  <span className="text-xs text-muted-foreground">(Optional)</span>
                </div>

                {menuItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No menu items found. Create menu items first to link them here.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {menuItems.map(item => {
                      const isSelected = form.linked_menu_item_ids.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleMenuItemLink(item.id)}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-all",
                            isSelected
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/40 hover:border-primary/30 hover:bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.name}
                              </p>
                              {item.price && (
                                <p className="text-xs text-muted-foreground">
                                  {item.price.toLocaleString()} MMK
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary flex items-center justify-center">
                                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogEditor;