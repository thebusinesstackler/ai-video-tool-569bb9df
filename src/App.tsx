import React, { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { BackgroundVideoProvider } from "@/contexts/BackgroundVideoContext";
import { BackgroundJobIndicator } from "@/components/BackgroundJobIndicator";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MovieSceneCreator from "./pages/MovieSceneCreator";
import Movies from "./pages/Movies";
import Characters from "./pages/Characters";
import Settings from "./pages/Settings";
import Reels from "./pages/Reels";
import Gallery from "./pages/Gallery";
import AITwin from "./pages/AITwin";
import TestimonialCommercial from "./pages/TestimonialCommercial";
import AISpokesperson from "./pages/AISpokesperson";
import HookEngine from "./pages/HookEngine";
import VideoRepo from "./pages/VideoRepo";
import VideoRepoPro from "./pages/VideoRepoPro";
import ProductLibrary from "./pages/ProductLibrary";
import VideoRepurposer from "./pages/VideoRepurposer";
import Podcast from "./pages/Podcast";
import NotFound from "./pages/NotFound";
import { ScrollToTop } from "./components/ScrollToTop";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BackgroundVideoProvider>
        <TooltipProvider>
          <Toaster />
          <BackgroundJobIndicator />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/movie-scene-creator" element={<ProtectedRoute><MovieSceneCreator /></ProtectedRoute>} />
              <Route path="/movies" element={<ProtectedRoute><Movies /></ProtectedRoute>} />
              <Route path="/scripts" element={<Navigate to="/reels" replace />} />
              <Route path="/characters" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
              <Route path="/projects" element={<Navigate to="/reels" replace />} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/reels" element={<ProtectedRoute><Reels /></ProtectedRoute>} />
              <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
              <Route path="/ai-twin" element={<ProtectedRoute><AITwin /></ProtectedRoute>} />
              <Route path="/testimonial-commercial" element={<ProtectedRoute><TestimonialCommercial /></ProtectedRoute>} />
              <Route path="/ai-spokesperson" element={<ProtectedRoute><AISpokesperson /></ProtectedRoute>} />
              <Route path="/videos" element={<Navigate to="/reels" replace />} />
              <Route path="/commercial-studio" element={<Navigate to="/testimonial-commercial" replace />} />
              <Route path="/hook-engine" element={<ProtectedRoute><HookEngine /></ProtectedRoute>} />
              <Route path="/video-repo" element={<ProtectedRoute><VideoRepo /></ProtectedRoute>} />
              <Route path="/video-repo-pro" element={<ProtectedRoute><VideoRepoPro /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><ProductLibrary /></ProtectedRoute>} />
              <Route path="/video-repurposer" element={<ProtectedRoute><VideoRepurposer /></ProtectedRoute>} />
              <Route path="/podcast" element={<ProtectedRoute><Podcast /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BackgroundVideoProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
