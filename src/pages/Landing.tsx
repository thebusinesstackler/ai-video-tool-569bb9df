import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  SparklesIcon, 
  VideoIcon, 
  UsersIcon, 
  FileTextIcon,
  ArrowRightIcon,
  CheckCircle2Icon
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border backdrop-blur-xl sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center animate-glow">
              <SparklesIcon className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="font-bold text-xl gradient-text">VideoAI Pro</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-primary">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium text-primary">
            <SparklesIcon className="w-4 h-4" />
            AI-Powered Video Creation
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold gradient-text leading-tight">
            Create Stunning Videos with AI
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your ideas into professional videos in minutes. Generate scripts, 
            create characters, and produce high-quality videos powered by advanced AI.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-primary h-12 px-8 text-base font-semibold">
                Start Creating <ArrowRightIcon className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
          <p className="text-xl text-muted-foreground">Powerful tools to bring your videos to life</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                <FileTextIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">AI Script Generator</h3>
              <p className="text-muted-foreground">
                Generate engaging video scripts instantly with AI-powered content creation.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Character Manager</h3>
              <p className="text-muted-foreground">
                Create and manage custom characters for your videos with ease.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                <VideoIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Video Production</h3>
              <p className="text-muted-foreground">
                Transform images into videos with multiple AI models and styles.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Advanced AI Models</h3>
              <p className="text-muted-foreground">
                Access cutting-edge AI models for various video styles and effects.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-6 py-20 bg-muted/30 rounded-3xl my-20">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl font-bold text-center mb-12">Why Choose VideoAI Pro?</h2>
          
          <div className="space-y-6">
            {[
              'Generate professional video scripts in seconds',
              'Create custom characters and personas',
              'Multiple AI model options for different styles',
              'Customizable video duration and resolution',
              'Project management and organization',
              'Real-time video processing status'
            ].map((benefit, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-6 h-6 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <CheckCircle2Icon className="w-4 h-4 text-primary-foreground" />
                </div>
                <p className="text-lg">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-8 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-2 border-primary/20 rounded-3xl p-12 shadow-glow">
          <h2 className="text-4xl font-bold">Ready to Create Amazing Videos?</h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of creators using VideoAI Pro to transform their ideas into reality.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-primary h-12 px-8 text-base font-semibold">
              Get Started for Free <ArrowRightIcon className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="container mx-auto px-6 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 VideoAI Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
