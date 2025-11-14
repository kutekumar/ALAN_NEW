import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, HashRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import RestaurantDetails from "./pages/RestaurantDetails";
import Payment from "./pages/Payment";
import Confirmation from "./pages/Confirmation";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Blog from "./pages/Blog";
import RestaurantDashboard from "./pages/dashboard/RestaurantDashboard";
import BlogEditor from "./pages/dashboard/BlogEditor";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRestaurants from "./pages/admin/AdminRestaurants";
import AdminOwners from "./pages/admin/AdminOwners";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            {/* Public / auth */}
            <Route path="/" element={<Onboarding />} />
            <Route path="/auth" element={<Auth />} />

            {/* Customer-facing */}
            <Route path="/home" element={<Home />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/restaurant/:id" element={<RestaurantDetails />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/confirmation" element={<Confirmation />} />

            {/* Restaurant owner dashboard */}
            <Route path="/dashboard" element={<RestaurantDashboard />} />
            <Route path="/dashboard/blog/new" element={<BlogEditor />} />
            <Route path="/dashboard/blog/edit/:postId" element={<BlogEditor />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/restaurants" element={<AdminRestaurants />} />
            <Route path="/admin/owners" element={<AdminOwners />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/users" element={<AdminUsers />} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
