import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Plus, LogOut, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Event {
  id: string;
  event_name: string;
  event_date: string;
  event_code: string;
  is_overnight: boolean;
}

const Dashboard = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
    });
    loadEvents();
    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadEvents = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }

    const { data: adminEntries } = await supabase
      .from("event_admins")
      .select("event_id")
      .eq("user_id", session.user.id);

    if (!adminEntries?.length) { setLoading(false); return; }

    const eventIds = adminEntries.map(e => e.event_id);
    const { data: events } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds)
      .order("created_at", { ascending: false });

    setEvents((events as Event[]) || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleDeleteEvent = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone and will delete all participants and teams associated with it.")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Event deleted successfully");
      loadEvents();
    } catch (err: any) {
      console.error("Error deleting event:", err);
      toast.error(err.message || "Failed to delete event. Make sure you are the creator.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex-shrink-0 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold truncate">EventPresence</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/create">
              <Button size="sm" className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">New Event</span><span className="sm:hidden">New</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="px-2">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Your Events</h1>
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : events.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center">
            <p className="text-muted-foreground mb-4">No events yet. Create your first one!</p>
            <Link to="/create">
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-1" /> Create Event
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map(event => (
              <Link
                key={event.id}
                to={`/admin/${event.id}`}
                className="glass-card rounded-xl p-5 flex items-center justify-between hover:shadow-xl transition-shadow group"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">{event.event_name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span className="whitespace-nowrap">{format(new Date(event.event_date), "MMM d, yyyy")}</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{event.event_code}</span>
                    {event.is_overnight && <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">Overnight</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => handleDeleteEvent(e, event.id)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Event"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
