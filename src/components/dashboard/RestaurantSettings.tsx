import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const RestaurantSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    description: '',
    image_url: '',
    open_hours: ''
  });

  useEffect(() => {
    if (user) {
      fetchRestaurantData();
    }
  }, [user]);

  const fetchRestaurantData = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error) throw error;

      setRestaurantId(data.id);
      setFormData({
        name: data.name,
        address: data.address,
        phone: data.phone || '',
        description: data.description || '',
        image_url: data.image_url || '',
        open_hours: data.open_hours || ''
      });
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      toast.error('Failed to load restaurant data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          description: formData.description,
          image_url: formData.image_url,
          open_hours: formData.open_hours
        })
        .eq('id', restaurantId);

      if (error) throw error;
      toast.success('Restaurant information updated successfully!');
    } catch (error) {
      console.error('Error updating restaurant:', error);
      toast.error('Failed to update restaurant information');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Restaurant Settings</h2>
        <p className="text-muted-foreground">Update your restaurant information</p>
      </div>

      <Card className="border-border/50 luxury-shadow">
        <CardHeader>
          <CardTitle>Restaurant Information</CardTitle>
          <CardDescription>Update your restaurant details and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cover Photo */}
          <div className="space-y-2">
            <Label htmlFor="image_url">Cover Photo URL</Label>
            <div className="space-y-2">
              {formData.image_url && (
                <div className="relative h-48 bg-muted rounded-lg overflow-hidden">
                  <img
                    src={formData.image_url}
                    alt="Restaurant cover"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Restaurant Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Restaurant Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          {/* Open Hours */}
          <div className="space-y-2">
            <Label htmlFor="open_hours">Open Hours</Label>
            <Input
              id="open_hours"
              value={formData.open_hours}
              onChange={(e) => setFormData({ ...formData, open_hours: e.target.value })}
              placeholder="9:00 AM - 10:00 PM"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Tell customers about your restaurant..."
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} className="luxury-gradient">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestaurantSettings;
