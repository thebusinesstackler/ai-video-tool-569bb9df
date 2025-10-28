import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  SparklesIcon, 
  VideoIcon, 
  UsersIcon, 
  FileTextIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CameraIcon,
  FilmIcon,
  TargetIcon,
  ClockIcon,
  DollarSignIcon,
  ZapIcon,
  MoveIcon,
  Maximize2Icon,
  EyeIcon,
  TrendingUpIcon,
  BriefcaseIcon,
  PlayIcon,
  LayersIcon,
  ClapperboardIcon
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
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Value Props Badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Badge variant="outline" className="px-4 py-2 text-sm border-primary/30 bg-primary/5">
              <CameraIcon className="w-4 h-4 mr-2" />
              50+ Camera Angle Presets
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm border-primary/30 bg-primary/5">
              <TargetIcon className="w-4 h-4 mr-2" />
              Start Frame + End Frame = Perfect Motion
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm border-primary/30 bg-primary/5">
              <DollarSignIcon className="w-4 h-4 mr-2" />
              Unlimited Videos • $149/mo
            </Badge>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold gradient-text leading-tight">
            Hollywood Quality.<br />Indie Budget.<br />AI-Powered.
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Create professional films, commercials, and video content with cinematic camera angles, 
            keyframe interpolation, and unlimited AI generation — all for $149/month.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-primary h-14 px-10 text-lg font-semibold shadow-glow">
                Start Free 7-Day Trial <ArrowRightIcon className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg">
              <PlayIcon className="mr-2 w-5 h-5" />
              Watch Demo
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            No credit card required • Full access • Cancel anytime
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-muted/30">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold gradient-text">10,000+</div>
              <div className="text-sm text-muted-foreground mt-1">Videos Created</div>
            </div>
            <div>
              <div className="text-3xl font-bold gradient-text">50+</div>
              <div className="text-sm text-muted-foreground mt-1">Camera Angles</div>
            </div>
            <div>
              <div className="text-3xl font-bold gradient-text">2,500+</div>
              <div className="text-sm text-muted-foreground mt-1">Active Creators</div>
            </div>
            <div>
              <div className="text-3xl font-bold gradient-text">30 Sec</div>
              <div className="text-sm text-muted-foreground mt-1">To First Frame</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground">From concept to final cut in three simple steps</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto animate-glow">
                <CameraIcon className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Choose Your Camera Angle</h3>
                <p className="text-muted-foreground">
                  Select from 50+ professional presets like Dolly Zoom, Tracking Shot, or Dutch Angle. 
                  No film school required.
                </p>
              </div>
              <div className="pt-4 flex flex-wrap gap-2 justify-center">
                <Badge variant="secondary" className="text-xs">Wide Shot</Badge>
                <Badge variant="secondary" className="text-xs">Close-Up</Badge>
                <Badge variant="secondary" className="text-xs">Tracking</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto animate-glow">
                <LayersIcon className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Define Keyframes</h3>
                <p className="text-muted-foreground">
                  Upload start and end frames. AI generates smooth, natural motion in between. 
                  Perfect for directors and actors.
                </p>
              </div>
              <div className="pt-4 flex items-center justify-center gap-2">
                <div className="w-12 h-12 border-2 border-primary rounded bg-primary/10 flex items-center justify-center text-xs font-semibold">
                  Start
                </div>
                <ArrowRightIcon className="w-4 h-4 text-muted-foreground" />
                <SparklesIcon className="w-5 h-5 text-primary animate-pulse" />
                <ArrowRightIcon className="w-4 h-4 text-muted-foreground" />
                <div className="w-12 h-12 border-2 border-primary rounded bg-primary/10 flex items-center justify-center text-xs font-semibold">
                  End
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto animate-glow">
                <VideoIcon className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Generate & Export</h3>
                <p className="text-muted-foreground">
                  Get production-ready videos in minutes at 1080p. Use in pitches, demo reels, 
                  or final productions.
                </p>
              </div>
              <div className="pt-4 flex flex-wrap gap-2 justify-center">
                <Badge variant="secondary" className="text-xs">480p</Badge>
                <Badge variant="secondary" className="text-xs">1080p</Badge>
                <Badge variant="secondary" className="text-xs">5s/10s</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Camera Angles Showcase Section */}
      <section className="container mx-auto px-6 py-20 bg-muted/30 rounded-3xl my-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Master Cinematography Without Film School</h2>
          <p className="text-xl text-muted-foreground">50+ Professional Camera Angles & Movements — Just Click and Create</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Classic Shots */}
          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Maximize2Icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Wide Shot</h3>
              <p className="text-sm text-muted-foreground">
                Set the scene and show environment. Perfect for establishing shots and context.
              </p>
              <Badge variant="secondary" className="text-xs">Establishing • Landscape</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <EyeIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Close-Up</h3>
              <p className="text-sm text-muted-foreground">
                Capture emotional moments and reveal details. Essential for dramatic tension.
              </p>
              <Badge variant="secondary" className="text-xs">Emotion • Detail</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <UsersIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Over-the-Shoulder</h3>
              <p className="text-sm text-muted-foreground">
                Perfect for conversations and POV establishment in dialogue scenes.
              </p>
              <Badge variant="secondary" className="text-xs">Dialogue • POV</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <TargetIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Medium Shot</h3>
              <p className="text-sm text-muted-foreground">
                Standard framing showing body language. Ideal for character interactions.
              </p>
              <Badge variant="secondary" className="text-xs">Dialogue • Body Language</Badge>
            </CardContent>
          </Card>

          {/* Dynamic Movements */}
          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <MoveIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Dolly Shot / Push In</h3>
              <p className="text-sm text-muted-foreground">
                Build tension and draw attention by moving camera toward subject dramatically.
              </p>
              <Badge variant="secondary" className="text-xs">Tension • Focus</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUpIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Tracking Shot</h3>
              <p className="text-sm text-muted-foreground">
                Follow character movement smoothly. Essential for action and walk-and-talk scenes.
              </p>
              <Badge variant="secondary" className="text-xs">Action • Movement</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <CameraIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Pan (Left/Right)</h3>
              <p className="text-sm text-muted-foreground">
                Reveal landscape or follow action horizontally. Great for sweeping vistas.
              </p>
              <Badge variant="secondary" className="text-xs">Reveal • Landscape</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClapperboardIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Tilt (Up/Down)</h3>
              <p className="text-sm text-muted-foreground">
                Show scale and reveal characters. Perfect for dramatic character introductions.
              </p>
              <Badge variant="secondary" className="text-xs">Scale • Reveal</Badge>
            </CardContent>
          </Card>

          {/* Creative Angles */}
          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ZapIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Dutch Angle</h3>
              <p className="text-sm text-muted-foreground">
                Create disorientation and unease. Essential for psychological thriller moments.
              </p>
              <Badge variant="secondary" className="text-xs">Tension • Psychological</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <FilmIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Bird's Eye View</h3>
              <p className="text-sm text-muted-foreground">
                God's perspective showing isolation. Perfect for dramatic overhead shots.
              </p>
              <Badge variant="secondary" className="text-xs">Overhead • Isolation</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUpIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Low Angle</h3>
              <p className="text-sm text-muted-foreground">
                Show power and intimidation. Make characters look heroic or threatening.
              </p>
              <Badge variant="secondary" className="text-xs">Power • Hero</Badge>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-glow group">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <SparklesIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Dolly Zoom</h3>
              <p className="text-sm text-muted-foreground">
                Vertigo effect for shocking revelations. Create memorable cinematic moments.
              </p>
              <Badge variant="secondary" className="text-xs">Dramatic • Iconic</Badge>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <Link to="/auth">
            <Button size="lg" variant="outline" className="h-12 px-8">
              View All 50+ Camera Angles <ArrowRightIcon className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Keyframe Technology Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">The Power of Keyframe Interpolation</h2>
          <p className="text-xl text-muted-foreground">Two Frames. Complete Scene. Hollywood Quality.</p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Visual Demonstration */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-16 p-8 bg-muted/30 rounded-2xl">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 border-2 border-primary rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-sm font-semibold">Start Frame</span>
              </div>
              <p className="text-sm text-muted-foreground">Where scene begins</p>
            </div>
            
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="w-6 h-6 text-muted-foreground" />
              <SparklesIcon className="w-8 h-8 text-primary animate-pulse" />
              <ArrowRightIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 border-2 border-primary rounded-lg bg-gradient-primary flex items-center justify-center mb-3">
                <VideoIcon className="w-12 h-12 text-primary-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-semibold">AI Magic</p>
            </div>
            
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="w-6 h-6 text-muted-foreground" />
              <SparklesIcon className="w-8 h-8 text-primary animate-pulse" />
              <ArrowRightIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 border-2 border-primary rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-sm font-semibold">End Frame</span>
              </div>
              <p className="text-sm text-muted-foreground">Where scene ends</p>
            </div>
          </div>

          {/* Use Cases Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <FilmIcon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Film Director: Action Sequence</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start: Character in doorway<br />
                      End: Character diving through window<br />
                      AI: Smooth athletic motion<br />
                      Camera: Tracking Shot
                    </p>
                    <Badge variant="secondary">$1.50 @ 1080p/10s</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <UsersIcon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Actor: Emotional Range Demo</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start: Neutral expression<br />
                      End: Crying dramatically<br />
                      AI: Natural facial transitions<br />
                      Camera: Close-Up
                    </p>
                    <Badge variant="secondary">$0.75 @ 1080p/5s</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <BriefcaseIcon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Commercial: Product Reveal</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start: Product in box<br />
                      End: Product being used<br />
                      AI: Unboxing motion<br />
                      Camera: Dolly Push In
                    </p>
                    <Badge variant="secondary">$1.50 @ 1080p/10s</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <CameraIcon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Short Film: Establishing Shot</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start: City skyline day<br />
                      End: City skyline sunset<br />
                      AI: Time-lapse effect<br />
                      Camera: Wide Shot
                    </p>
                    <Badge variant="secondary">$1.50 @ 1080p/10s</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Who Is This For Section */}
      <section className="container mx-auto px-6 py-20 bg-muted/30 rounded-3xl my-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Who Is This For?</h2>
          <p className="text-xl text-muted-foreground">Professional tools for every creator</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardContent className="pt-8 space-y-4">
              <div className="w-14 h-14 bg-gradient-primary rounded-xl flex items-center justify-center">
                <FilmIcon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold">Independent Film Directors</h3>
              <p className="text-lg font-semibold text-primary">Pre-Visualize Your Vision Before You Shoot</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Stop trying to explain shots to investors — show them</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Test 5 different blocking options for $7.50 instead of $5,000</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Create pitch decks that get funded</span>
                </li>
              </ul>
              <div className="pt-4 bg-primary/5 rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Real Example:</p>
                <p className="text-sm text-muted-foreground">3-minute short film: 20 scenes × $1.50 = $30 vs. $15,000 traditional</p>
                <Badge className="mt-2" variant="secondary">99.8% Savings</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardContent className="pt-8 space-y-4">
              <div className="w-14 h-14 bg-gradient-primary rounded-xl flex items-center justify-center">
                <UsersIcon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold">Actors & Performers</h3>
              <p className="text-lg font-semibold text-primary">Build Hollywood-Quality Demo Reels From Home</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>No crew, equipment, or location fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Create 15 character showcases in one afternoon</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Update your reel monthly without breaking the bank</span>
                </li>
              </ul>
              <div className="pt-4 bg-primary/5 rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Real Example:</p>
                <p className="text-sm text-muted-foreground">10-scene demo reel with range: $15 vs. $3,000+ traditional shoot</p>
                <Badge className="mt-2" variant="secondary">99.5% Savings</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardContent className="pt-8 space-y-4">
              <div className="w-14 h-14 bg-gradient-primary rounded-xl flex items-center justify-center">
                <BriefcaseIcon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold">Commercial Producers</h3>
              <p className="text-lg font-semibold text-primary">Create Client Concepts in Hours, Not Weeks</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Pitch 5 concepts before committing to production</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>A/B test different angles and approaches instantly</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Generate platform variations (16:9, 9:16, 1:1)</span>
                </li>
              </ul>
              <div className="pt-4 bg-primary/5 rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Real Example:</p>
                <p className="text-sm text-muted-foreground">30s commercial with 3 variations: $22.50 vs. $10,000+ production</p>
                <Badge className="mt-2" variant="secondary">99.8% Savings</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardContent className="pt-8 space-y-4">
              <div className="w-14 h-14 bg-gradient-primary rounded-xl flex items-center justify-center">
                <VideoIcon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold">Content Creators</h3>
              <p className="text-lg font-semibold text-primary">Professional Cinematic Content Without Pro Budget</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Make content that looks like it had a film crew</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Create multiple platform versions instantly</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Stand out with Hollywood-level production value</span>
                </li>
              </ul>
              <div className="pt-4 bg-primary/5 rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Real Example:</p>
                <p className="text-sm text-muted-foreground">20 social videos/month: $149 vs. $500-1000 per video</p>
                <Badge className="mt-2" variant="secondary">90% Savings</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Professional Filmmaking Tools</h2>
          <p className="text-xl text-muted-foreground">All for $149/month</p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Main Pricing Card */}
          <Card className="border-4 border-primary shadow-glow">
            <CardContent className="pt-12 pb-12">
              <div className="text-center mb-8">
                <Badge className="mb-4 text-sm px-4 py-1">MOST POPULAR</Badge>
                <h3 className="text-3xl font-bold mb-2">VideoAI Pro Unlimited</h3>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-6xl font-bold gradient-text">$149</span>
                  <span className="text-2xl text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground">Create 50-100+ videos per month</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Unlimited Video Generation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>50+ Camera Angle Presets</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Keyframe Interpolation Technology</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Multiple Resolutions (480p, 1080p)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Multiple AI Models (WAN 2.5 + more)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Character Library & Management</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>AI Script Generator</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Negative Prompt Control</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Unlimited Variations Per Scene</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Project Management System</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Auto Video Stitching</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Commercial License Included</span>
                  </div>
                </div>
              </div>

              <Link to="/auth" className="block">
                <Button size="lg" className="w-full bg-gradient-primary h-14 text-lg font-semibold shadow-glow">
                  Start Free 7-Day Trial <ArrowRightIcon className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              
              <p className="text-center text-sm text-muted-foreground mt-4">
                No credit card required • Cancel anytime • 14-day money-back guarantee
              </p>
            </CardContent>
          </Card>

          {/* Cost Comparison */}
          <div className="mt-16 grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-center">Traditional Production</h3>
              <Card className="border-2 border-muted">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Director of Photography</span>
                    <span className="font-semibold">$1,500/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Equipment Rental</span>
                    <span className="font-semibold">$800/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location Fees</span>
                    <span className="font-semibold">$500-2,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Crew (3-5 people)</span>
                    <span className="font-semibold">$1,200-2,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Post-production</span>
                    <span className="font-semibold">$2,000+</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between text-lg font-bold">
                    <span>Total (1-day shoot):</span>
                    <span className="text-destructive">$6,000-10,000</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-center">VideoAI Pro</h3>
              <Card className="border-2 border-primary">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unlimited Videos</span>
                    <span className="font-semibold text-primary">$149/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">50+ Camera Angles</span>
                    <span className="font-semibold text-primary">Included</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">All AI Models</span>
                    <span className="font-semibold text-primary">Included</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project Management</span>
                    <span className="font-semibold text-primary">Included</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commercial License</span>
                    <span className="font-semibold text-primary">Included</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between text-lg font-bold">
                    <span>Total per month:</span>
                    <span className="gradient-text">$149</span>
                  </div>
                  <Badge className="w-full justify-center text-center py-2" variant="secondary">
                    99.3% Cost Savings vs Traditional
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Per-Segment Pricing */}
          <div className="mt-12 bg-muted/30 rounded-xl p-8">
            <h3 className="text-xl font-bold text-center mb-6">Transparent Per-Segment Pricing</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="font-bold text-2xl gradient-text">$0.25</div>
                <div className="text-sm text-muted-foreground">480p @ 5s</div>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-2xl gradient-text">$0.50</div>
                <div className="text-sm text-muted-foreground">480p @ 10s</div>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-2xl gradient-text">$0.75</div>
                <div className="text-sm text-muted-foreground">1080p @ 5s</div>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-2xl gradient-text">$1.50</div>
                <div className="text-sm text-muted-foreground">1080p @ 10s</div>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Most users create 50-100 segments per month, making unlimited cost-effective at $149/mo
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-6 py-20 bg-muted/30 rounded-3xl my-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything a Professional Filmmaker Needs</h2>
          <p className="text-xl text-muted-foreground">Complete toolkit for cinematic video creation</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <CameraIcon className="w-6 h-6 text-primary" />
              Cinematic Excellence
            </h3>
            <div className="space-y-3">
              {[
                '50+ professional camera angles',
                'Hollywood-quality output (1080p)',
                'Smooth keyframe interpolation',
                'Natural motion generation',
                'No animation skills required'
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ZapIcon className="w-6 h-6 text-primary" />
              Speed & Efficiency
            </h3>
            <div className="space-y-3">
              {[
                'Scenes in minutes, not days',
                'Unlimited variations per scene',
                'Fast iteration for feedback',
                'Real-time processing status',
                'Auto video stitching'
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <DollarSignIcon className="w-6 h-6 text-primary" />
              Unbeatable Value
            </h3>
            <div className="space-y-3">
              {[
                '$149/month unlimited creation',
                'No per-video charges',
                'Commercial license included',
                'Cancel anytime',
                '99.7% cheaper than traditional'
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-2 border-primary/20 rounded-3xl p-12 shadow-glow">
          <h2 className="text-4xl md:text-5xl font-bold">Your Next Hollywood-Quality Project Starts Today</h2>
          <p className="text-xl text-muted-foreground">
            Join 2,500+ creators who've produced over 10,000 videos with professional camera angles and keyframe AI
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-primary h-14 px-10 text-lg font-semibold shadow-glow">
                Start Free 7-Day Trial <ArrowRightIcon className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg">
              <PlayIcon className="mr-2 w-5 h-5" />
              Watch 3-Minute Demo
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground pt-4">
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="w-4 h-4 text-primary" />
              No credit card required
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="w-4 h-4 text-primary" />
              14-day money-back guarantee
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="w-4 h-4 text-primary" />
              Cancel anytime
            </span>
          </div>
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
