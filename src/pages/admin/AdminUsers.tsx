import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Shield, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  user_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  created_at: string;
}

const AdminUsers = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      toast.error('Admin access required');
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchUsers();
    }
  }, [user, userRole]);

  useEffect(() => {
    const filtered = users.filter((u) =>
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    // Fetch all user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, created_at')
      .order('created_at', { ascending: false });

    if (rolesError) {
      toast.error('Failed to load users');
      return;
    }

    // Fetch profiles for all users
    const userIds = userRoles.map(r => r.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds);

    if (profilesError) {
      toast.error('Failed to load user profiles');
      return;
    }

    const usersData: User[] = userRoles.map(role => {
      const profile = profiles.find(p => p.id === role.user_id);
      return {
        user_id: role.user_id,
        full_name: profile?.full_name || 'Unknown',
        phone: profile?.phone || null,
        role: role.role,
        created_at: role.created_at,
      };
    });

    setUsers(usersData);
    setFilteredUsers(usersData);
  };

  const getRoleBadge = (role: string) => {
    const variants: { [key: string]: { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any } } = {
      admin: { variant: 'destructive', icon: Shield },
      restaurant_owner: { variant: 'default', icon: UserIcon },
      customer: { variant: 'secondary', icon: UserIcon },
    };

    const config = variants[role] || variants.customer;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {role.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getRoleStats = () => {
    const admins = users.filter(u => u.role === 'admin').length;
    const owners = users.filter(u => u.role === 'restaurant_owner').length;
    const customers = users.filter(u => u.role === 'customer').length;
    return { admins, owners, customers };
  };

  const stats = getRoleStats();

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
            <h1 className="text-4xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Manage all registered users</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                Admins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.admins}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" />
                Restaurant Owners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.owners}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-secondary" />
                Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.customers}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>{u.phone || 'N/A'}</TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
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

export default AdminUsers;
