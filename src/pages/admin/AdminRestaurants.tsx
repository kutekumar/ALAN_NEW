import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  description: string | null;
  phone: string | null;
  cuisine_type: string | null;
  owner_id: string | null;
  image_url: string | null;
}

const AdminRestaurants = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    description: '',
    phone: '',
    cuisine_type: '',
    image_url: '',
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      toast.error('Admin access required');
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchRestaurants();
    }
  }, [user, userRole]);

  useEffect(() => {
    const filtered = restaurants.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredRestaurants(filtered);
  }, [searchQuery, restaurants]);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load restaurants');
      return;
    }

    setRestaurants(data || []);
    setFilteredRestaurants(data || []);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.address) {
      toast.error('Name and address are required');
      return;
    }

    if (editingRestaurant) {
      const { error } = await supabase
        .from('restaurants')
        .update(formData)
        .eq('id', editingRestaurant.id);

      if (error) {
        toast.error('Failed to update restaurant');
        return;
      }

      toast.success('Restaurant updated successfully');
    } else {
      const { error } = await supabase
        .from('restaurants')
        .insert([formData]);

      if (error) {
        toast.error('Failed to create restaurant');
        return;
      }

      toast.success('Restaurant created successfully');
    }

    setIsDialogOpen(false);
    resetForm();
    fetchRestaurants();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant?')) return;

    const { error } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete restaurant');
      return;
    }

    toast.success('Restaurant deleted successfully');
    fetchRestaurants();
  };

  const handleEdit = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setFormData({
      name: restaurant.name,
      address: restaurant.address,
      description: restaurant.description || '',
      phone: restaurant.phone || '',
      cuisine_type: restaurant.cuisine_type || '',
      image_url: restaurant.image_url || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRestaurant(null);
    setFormData({
      name: '',
      address: '',
      description: '',
      phone: '',
      cuisine_type: '',
      image_url: '',
    });
  };

  if (loading || !user || userRole !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground">Restaurant Management</h1>
            <p className="text-muted-foreground">Manage all restaurants on the platform</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Restaurant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRestaurant ? 'Edit Restaurant' : 'Add New Restaurant'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Restaurant Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter restaurant name"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="cuisine_type">Cuisine Type</Label>
                  <Input
                    id="cuisine_type"
                    value={formData.cuisine_type}
                    onChange={(e) => setFormData({ ...formData, cuisine_type: e.target.value })}
                    placeholder="e.g., Italian, Chinese"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter restaurant description"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="Enter image URL"
                  />
                </div>
                <Button onClick={handleSave} className="w-full">
                  {editingRestaurant ? 'Update Restaurant' : 'Create Restaurant'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Restaurants Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Restaurants ({filteredRestaurants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Cuisine</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRestaurants.map((restaurant) => (
                    <TableRow key={restaurant.id}>
                      <TableCell className="font-medium">{restaurant.name}</TableCell>
                      <TableCell>{restaurant.address}</TableCell>
                      <TableCell>{restaurant.phone || 'N/A'}</TableCell>
                      <TableCell>{restaurant.cuisine_type || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(restaurant)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(restaurant.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRestaurants;
