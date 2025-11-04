import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Star, MapPin, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('rating', { ascending: false });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      toast.error('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (restaurant.cuisine_type?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-6">
        <div className="max-w-md mx-auto space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">ALAN</h1>
            <p className="text-muted-foreground">Discover premium dining</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search restaurants or cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Restaurant List */}
      <div className="max-w-md mx-auto px-6 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No restaurants found
          </div>
        ) : (
          filteredRestaurants.map((restaurant) => (
          <Card
            key={restaurant.id}
            className="overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
            onClick={() => navigate(`/restaurant/${restaurant.id}`)}
          >
            <div className="relative h-48">
              <img
                src={restaurant.image_url}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3">
                <Badge className="bg-primary text-primary-foreground border-0">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  {restaurant.rating}
                </Badge>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground">{restaurant.name}</h3>
                  <p className="text-sm text-muted-foreground">{restaurant.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Badge variant="secondary" className="font-normal">
                  {restaurant.cuisine_type}
                </Badge>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {restaurant.distance}
                </div>
              </div>
            </div>
          </Card>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
