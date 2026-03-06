import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarCheck, Users, ArrowRight, Zap, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src="/devx-logo.png" alt="DevX Logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
              <CalendarCheck className="w-5 h-5 text-primary" id="fallback-logo" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold leading-none">EventPresence</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">by DevX</span>
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
              Real-time attendance tracking
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
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 text-base h-12">
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
                className="glass-card rounded-xl p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 bg-secondary/5">
        <div className="container mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/devx-logo.png" alt="DevX Logo" className="w-6 h-6 object-contain opacity-50" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="text-sm font-semibold text-muted-foreground">Made with ❤️ by DevX</span>
          </div>
          <p className="text-center text-muted-foreground text-xs">
            EventPresence — Fast attendance tracking for modern events.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
