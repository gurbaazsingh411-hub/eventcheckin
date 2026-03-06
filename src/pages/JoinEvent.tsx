import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarCheck, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ScheduleItem {
  time: string;
  title: string;
}

const JoinEvent = () => {
  const { code: urlCode } = useParams();
  const [eventCode, setEventCode] = useState(urlCode || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [eventName, setEventName] = useState("");

  // Sync state with URL parameter
  useState(() => {
    if (urlCode && !eventCode) setEventCode(urlCode);
  });

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("confirm_attendance", {
        _event_code: eventCode.toUpperCase().trim(),
        _email: email.trim(),
        _name: name.trim(),
      });

      if (error) {
        console.error("RPC Error:", error);
        throw error;
      }
      const result = data as any;
      if (!result.success) {
        console.warn("Confirmation failed:", result.error);
        toast.error(result.error);
        return;
      }

      setConfirmed(true);
      setSchedule(result.schedule || []);
      setEventName(result.event_name || "");
      toast.success("Attendance confirmed!");
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
          <div className="flex flex-col text-left">
            <span className="text-xl font-bold leading-none">Join Event</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider mt-1">Powered by DevX</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!confirmed ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card rounded-xl p-6"
            >
              <h2 className="text-lg font-semibold mb-1">Confirm Your Presence</h2>
              <p className="text-muted-foreground text-sm mb-6">Enter the event code and your details to confirm attendance.</p>
              <form onSubmit={handleConfirm} className="space-y-4">
                <div>
                  <Label htmlFor="code">Event Code</Label>
                  <Input
                    id="code"
                    value={eventCode}
                    onChange={e => setEventCode(e.target.value)}
                    placeholder="e.g. HCKT24"
                    required
                    maxLength={6}
                    className="uppercase tracking-widest text-center text-lg font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                  {loading ? "Confirming..." : "Confirm Attendance"}
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl p-6"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-xl font-semibold">You're confirmed!</h2>
                <p className="text-muted-foreground text-sm mt-1">Your attendance for <strong>{eventName}</strong> has been recorded.</p>
              </div>

              {schedule.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Event Schedule
                  </h3>
                  <div className="space-y-2">
                    {schedule.map((item, i) => (
                      <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-secondary/50">
                        <span className="text-sm font-mono text-primary font-medium whitespace-nowrap">{item.time}</span>
                        <span className="text-sm">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default JoinEvent;
