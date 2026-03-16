import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Film, Smartphone, ScanFace } from "lucide-react";

const suggestedRoutes = [
  { path: "/reels", label: "Create a Reel", icon: Smartphone },
  { path: "/movie-scene-creator", label: "Movie Scene Creator", icon: Film },
  { path: "/ai-twin", label: "AI Twin Studio", icon: ScanFace },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-xl text-muted-foreground">
          The page <code className="text-sm bg-muted px-2 py-1 rounded">{location.pathname}</code> doesn't exist.
        </p>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">Try one of these instead:</p>
          {suggestedRoutes.map(route => (
            <Button key={route.path} asChild variant="outline" className="w-full justify-start gap-2">
              <Link to={route.path}>
                <route.icon className="w-4 h-4" />
                {route.label}
              </Link>
            </Button>
          ))}
        </div>
        <Button asChild variant="default">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
