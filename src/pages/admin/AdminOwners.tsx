import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Search, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface Owner {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
}

interface Restaurant {
  id: string;
  name: string;
}

const AdminOwners = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<Owner[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    restaurantId: '',
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      toast.error('Admin access required');
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchOwners();
      fetchRestaurants();
    }
  }, [user, userRole]);

  useEffect(() => {
    const filtered = owners.filter((owner) =>
      owner.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (owner.restaurant_name && owner.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredOwners(filtered);
  }, [searchQuery, owners]);

  const fetchOwners = async () => {
    // Fetch all restaurant owners
    const { data: ownerRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'restaurant_owner');

    if (rolesError) {
      toast.error('Failed to load owners');
      return;
    }

    const ownerIds = ownerRoles.map(role => role.user_id);

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', ownerIds);

    if (profilesError) {
      toast.error('Failed to load owner profiles');
      return;
    }

    // Fetch their restaurants
    const { data: restaurantsData, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, owner_id')
      .in('owner_id', ownerIds);

    if (restaurantsError) {
      console.error('Failed to load restaurants:', restaurantsError);
    }

    // We need to get emails from auth.users metadata via a server function
    // For now, we'll show a placeholder and implement proper email fetching
    const ownersData: Owner[] = profiles.map(profile => {
      const restaurant = restaurantsData?.find(r => r.owner_id === profile.id);
      return {
        user_id: profile.id,
        full_name: profile.full_name,
        email: 'owner@example.com', // Placeholder - would need server function to get real email
        phone: profile.phone,
        restaurant_id: restaurant?.id || null,
        restaurant_name: restaurant?.name || null,
      };
    });

    setOwners(ownersData);
    setFilteredOwners(ownersData);
  };

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name')
      .is('owner_id', null)
      .order('name');

    if (error) {
      console.error('Failed to load restaurants:', error);
      return;
    }

    setRestaurants(data || []);
  };

  const handleCreateOwner = async () => {
    if (!formData.email || !formData.password || !formData.fullName || !formData.restaurantId) {
      toast.error('All fields are required');
      return;
    }

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
          },
        },
      });

      if (authError) {
        toast.error(`Failed to create owner account: ${authError.message}`);
        return;
      }

      if (!authData.user) {
        toast.error('Failed to create owner account');
        return;
      }

      // Assign restaurant owner role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{ user_id: authData.user.id, role: 'restaurant_owner' }]);

      if (roleError) {
        toast.error('Failed to assign owner role');
        return;
      }

      // Link restaurant to owner
      const { error: restaurantError } = await supabase
        .from('restaurants')
        .update({ owner_id: authData.user.id })
        .eq('id', formData.restaurantId);

      if (restaurantError) {
        toast.error('Failed to link restaurant to owner');
        return;
      }

      toast.success('Restaurant owner created successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchOwners();
      fetchRestaurants();
    } catch (error) {
      console.error('Error creating owner:', error);
      toast.error('Failed to create owner');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      phone: '',
      restaurantId: '',
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
            <h1 className="text-4xl font-bold text-foreground">Restaurant Owner Management</h1>
            <p className="text-muted-foreground">Manage all restaurant owner accounts</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={restaurants.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Owner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Restaurant Owner</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="owner@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+95..."
                  />
                </div>
                <div>
                  <Label htmlFor="restaurant">Restaurant *</Label>
                  <Select value={formData.restaurantId} onValueChange={(value) => setFormData({ ...formData, restaurantId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map((restaurant) => (
                        <SelectItem key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateOwner} className="w-full">
                  Create Owner Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Alert */}
        {restaurants.length === 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-amber-800">
                No restaurants available without owners. Please create restaurants first before adding owners.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search owners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Owners Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Restaurant Owners ({filteredOwners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOwners.map((owner) => (
                    <TableRow key={owner.user_id}>
                      <TableCell className="font-medium">{owner.full_name}</TableCell>
                      <TableCell>{owner.phone || 'N/A'}</TableCell>
                      <TableCell>
                        {owner.restaurant_name ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {owner.restaurant_name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No restaurant</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          View Details
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

export default AdminOwners;
