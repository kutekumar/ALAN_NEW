import { Home, Receipt, BookOpenText, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 border-t border-border glass-effect z-50 backdrop-blur-xl">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-4">
        <Link
          to="/home"
          className={`flex flex-col items-center justify-center flex-1 transition-colors ${
            isActive('/home') ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Home className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Home</span>
        </Link>

        <Link
          to="/orders"
          className={`flex flex-col items-center justify-center flex-1 transition-colors ${
            isActive('/orders') ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Receipt className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Orders</span>
        </Link>

        <Link
          to="/blog"
          className={`flex flex-col items-center justify-center flex-1 transition-colors ${
            isActive('/blog') ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <BookOpenText className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Blog</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-col items-center justify-center flex-1 transition-colors ${
            isActive('/profile') ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <User className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  );
};
