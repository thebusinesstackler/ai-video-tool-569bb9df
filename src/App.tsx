import React, { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MovieSceneCreator from "./pages/MovieSceneCreator";
import Movies from "./pages/Movies";
import Scripts from "./pages/Scripts";
import Characters from "./pages/Characters";
import Projects from "./pages/Projects";
import Settings from "./pages/Settings";
import Reels from "./pages/Reels";
import Gallery from "./pages/Gallery";
import AITwin from "./pages/AITwin";
import TestimonialCommercial from "./pages/TestimonialCommercial";
import AISpokesperson from "./pages/AISpokesperson";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/movie-scene-creator" element={<ProtectedRoute><MovieSceneCreator /></ProtectedRoute>} />
            <Route path="/movies" element={<ProtectedRoute><Movies /></ProtectedRoute>} />
            <Route path="/scripts" element={<ProtectedRoute><Scripts /></ProtectedRoute>} />
            <Route path="/characters" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/reels" element={<ProtectedRoute><Reels /></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
            <Route path="/ai-twin" element={<ProtectedRoute><AITwin /></ProtectedRoute>} />
            <Route path="/testimonial-commercial" element={<ProtectedRoute><TestimonialCommercial /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
