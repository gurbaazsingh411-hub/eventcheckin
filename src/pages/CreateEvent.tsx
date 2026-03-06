import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalendarCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

function generateEventCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const CreateEvent = () => {
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [isOvernight, setIsOvernight] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const eventCode = generateEventCode();
      const { data: event, error } = await supabase.from("events").insert({
        event_name: eventName,
        event_date: eventDate,
        event_code: eventCode,
        is_overnight: isOvernight,
        created_by: session.user.id,
      }).select().single();

      if (error) throw error;

      // Add creator as admin
      await supabase.from("event_admins").insert({
        event_id: event.id,
        user_id: session.user.id,
        role: "owner",
      });

      toast.success("Event created!");
      navigate(`/admin/${event.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="container mx-auto max-w-lg">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">Create Event</span>
        </div>
        <div className="glass-card rounded-xl p-6">
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <Label htmlFor="name">Event Name</Label>
              <Input id="name" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Hackathon 2026" required />
            </div>
            <div>
              <Label htmlFor="date">Event Date</Label>
              <Input id="date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Overnight Event</Label>
                <p className="text-muted-foreground text-sm">Track overnight stay lists</p>
              </div>
              <Switch checked={isOvernight} onCheckedChange={setIsOvernight} />
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateEvent;
