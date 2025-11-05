import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, ShoppingBag, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Stats {
  totalRestaurants: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
}

const AdminDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalRestaurants: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      toast.error('Admin access required');
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchStats();
    }
  }, [user, userRole]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);

      // Fetch restaurants count
      const { count: restaurantsCount } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true });

      // Fetch orders count and revenue
      const { data: orders, count: ordersCount } = await supabase
        .from('orders')
        .select('total_amount', { count: 'exact' });

      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

      // Fetch customers count (users with customer role)
      const { count: customersCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');

      setStats({
        totalRestaurants: restaurantsCount || 0,
        totalOrders: ordersCount || 0,
        totalCustomers: customersCount || 0,
        totalRevenue: totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || userRole !== 'admin') {
    return null;
  }

  const statCards = [
    {
      title: 'Total Restaurants',
      value: stats.totalRestaurants,
      icon: Building2,
      description: 'Active restaurants',
      color: 'text-blue-600',
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingBag,
      description: 'All time orders',
      color: 'text-green-600',
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      icon: Users,
      description: 'Registered customers',
      color: 'text-purple-600',
    },
    {
      title: 'Total Revenue',
      value: `${stats.totalRevenue.toLocaleString()} MMK`,
      icon: DollarSign,
      description: 'All time revenue',
      color: 'text-yellow-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your ALAN platform</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate('/admin/restaurants')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Restaurants
              </CardTitle>
              <CardDescription>Manage all restaurants</CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate('/admin/owners')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Restaurant Owners
              </CardTitle>
              <CardDescription>Manage owner accounts</CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate('/admin/orders')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Orders Report
              </CardTitle>
              <CardDescription>View all orders</CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate('/admin/users')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users
              </CardTitle>
              <CardDescription>Manage all users</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
