import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarCheck, Users, ArrowRight, Zap, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    VANTA: any;
  }
}

const Index = () => {
  const vantaRef = useRef<HTMLDivElement>(null);
  const [vantaEffect, setVantaEffect] = useState<any>(null);

  useEffect(() => {
    if (!vantaEffect && window.VANTA && vantaRef.current) {
      setVantaEffect(
        window.VANTA.BIRDS({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          quantity: 4.0,
          backgroundColor: 0xffffff, // White background
          color1: 0xc2410c,           // Darker Orange (Tailwind orange-700)
          color2: 0x9a3412,           // Even Darker Orange (Tailwind orange-800)
          birdSize: 1.2,
          wingSpan: 20.0,
          speedLimit: 4.0,
          separation: 50.0,
          alignment: 50.0,
          cohesion: 50.0,
        })
      );
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      {/* Vanta Background Container */}
      <div
        ref={vantaRef}
        className="fixed inset-0 z-0 pointer-events-none opacity-70"
      />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
          <div className="container mx-auto flex items-center justify-between h-16 px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/devx-logo.png" alt="DevX Logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                <CalendarCheck className="w-5 h-5 text-primary" id="fallback-logo" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold leading-none tracking-tight">EventPresence</span>
                <span className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] mt-0.5">by DevX</span>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-32 pb-20 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
                Real-time attendance tracking • Powered by DevX
              </div>
              <div className="text-[12px] font-bold text-primary/60 uppercase tracking-[0.3em] mb-4">
                A DevX Product
              </div>
              <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                Event check-in,
                <br />
                <span className="gradient-text">made effortless</span>
              </h1>
              <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Create events, upload participant lists, and track attendance in real-time.
                No participant accounts needed — just a code and a click.
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Link to="/create" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto gradient-primary text-primary-foreground px-8 text-base h-12 shadow-lg hover:shadow-xl transition-shadow">
                  Create Event
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/join" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 text-base h-12 bg-background/50 backdrop-blur-sm">
                  Join Event
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Zap, title: "Instant Setup", desc: "Create an event in seconds. Share the code. Done." },
                { icon: Shield, title: "No Login Required", desc: "Participants confirm attendance with just their name and email." },
                { icon: Clock, title: "Real-Time Tracking", desc: "Watch confirmations flow in live on your dashboard." },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  className="glass-card rounded-xl p-6 relative overflow-hidden group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                >
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 text-left">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-left">
                      <f.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                    <p className="text-muted-foreground text-sm">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-12 px-4 bg-secondary/5 backdrop-blur-sm">
          <div className="container mx-auto flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open('https://devxgtbit.netlify.app', '_blank')}>
              <img src="/devx-logo.png" alt="DevX Logo" className="w-6 h-6 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
              <span className="text-sm font-bold text-foreground">Made with ❤️ by <span className="text-primary italic">DevX</span></span>
            </div>
            <p className="text-center text-muted-foreground text-xs">
              EventPresence — Fast attendance tracking for modern events.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
