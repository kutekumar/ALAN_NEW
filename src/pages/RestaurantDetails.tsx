import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Star, MapPin, Clock, Phone, Plus, Minus, ShoppingBag, UtensilsCrossed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  cuisine_type: string | null;
  address: string;
  phone: string | null;
  image_url: string | null;
  rating: number | null;
  distance: string | null;
  open_hours: string | null;
}

interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
}

const RestaurantDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');

  useEffect(() => {
    if (id) {
      fetchRestaurantAndMenu();
    }
  }, [id]);

  const fetchRestaurantAndMenu = async () => {
    try {
      const [restaurantRes, menuRes] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', id).single(),
        supabase.from('menu_items').select('*').eq('restaurant_id', id).eq('available', true)
      ]);

      if (restaurantRes.error) throw restaurantRes.error;
      if (menuRes.error) throw menuRes.error;

      setRestaurant(restaurantRes.data);
      setMenuItems(menuRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load restaurant details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Restaurant not found</h2>
          <Button onClick={() => navigate('/home')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => 
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleProceedToPayment = () => {
    if (cart.length === 0) {
      toast.error('Please add items to your cart');
      return;
    }
    navigate('/payment', { state: { cart, restaurant, orderType, totalAmount } });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Image */}
      <div className="relative h-64">
        <img
          src={restaurant.image_url}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-black/50 text-white hover:bg-black/70"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Restaurant Info */}
      <div className="max-w-md mx-auto px-6 py-6 space-y-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{restaurant.name}</h1>
              <p className="text-muted-foreground">{restaurant.description}</p>
            </div>
            <Badge className="bg-primary text-primary-foreground border-0">
              <Star className="h-3 w-3 mr-1 fill-current" />
              {restaurant.rating}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {restaurant.distance}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {restaurant.open_hours}
            </div>
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {restaurant.phone}
            </div>
          </div>
        </div>

        {/* Order Type Selection */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Order Type</h3>
          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dine_in">
                <UtensilsCrossed className="h-4 w-4 mr-2" />
                Dine In
              </TabsTrigger>
              <TabsTrigger value="takeaway">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Takeaway
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        {/* Menu */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Menu</h2>
          {menuItems.map((item) => {
            const cartItem = cart.find(c => c.id === item.id);
            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="flex gap-4 p-4">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">
                        {item.price.toLocaleString()} MMK
                      </span>
                      {cartItem ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{cartItem.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => addToCart(item)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToCart(item)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cart Summary Footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{totalItems} items</div>
              <div className="text-lg font-bold">{totalAmount.toLocaleString()} MMK</div>
            </div>
            <Button
              onClick={handleProceedToPayment}
              className="luxury-gradient"
              size="lg"
            >
              Proceed to Payment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDetails;
