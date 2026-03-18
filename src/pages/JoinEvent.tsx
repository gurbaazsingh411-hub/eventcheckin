import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CalendarCheck, 
  ArrowLeft, 
  CheckCircle2, 
  Clock,
  Edit2,
  Save,
  XCircle,
  Hash,
  Users,
  MapPin,
  Code,
  Github,
  Loader2,
  Moon
} from "lucide-react";
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
  const [phone, setPhone] = useState("");
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [eventName, setEventName] = useState("");
  const [participantData, setParticipantData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  interface Room {
    id: string;
    name: string;
  }

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [track, setTrack] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
  const [isOvernight, setIsOvernight] = useState(false);
  const [overnightStay, setOvernightStay] = useState(false);

  // Sync state with URL parameter and check session
  useEffect(() => {
    if (urlCode && !eventCode) setEventCode(urlCode);
    
    const checkSession = async () => {
      const saved = localStorage.getItem("event-presence-session");
      if (saved) {
        try {
          const { participantId } = JSON.parse(saved);
          const { data, error } = await supabase
            .from('participants')
            .select(`
              *,
              events(event_name, schedule, is_overnight),
              teams(name, join_code)
            `)
            .eq('id', participantId)
            .single();
            
          if (data && !error) {
            const d = data as any;
            setConfirmed(true);
            setEventName(d.events.event_name);
            setSchedule(d.events.schedule || []);
            setIsOvernight(d.events.is_overnight || false);
            setParticipantData({
              ...d,
              team_name: d.teams?.name,
              team_join_code: d.teams?.join_code
            });
            setName(d.name);
            setEmail(d.email);
            setPhone(d.phone_number || "");
            if (d.room_id) setSelectedRoom(d.room_id);
            if (d.track) setTrack(d.track);
            if (d.github_repo) setGithubRepo(d.github_repo);
            if (d.overnight_stay !== null) setOvernightStay(d.overnight_stay);
          }
        } catch (e) {
          console.error("Session load failed", e);
        }
      }
    };
    checkSession();
  }, [urlCode]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      toast.error("Team Name is required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("confirm_attendance", {
        _event_code: eventCode.toUpperCase().trim(),
        _email: email.trim(),
        _name: name.trim(),
        _phone_number: phone.trim(),
        _team_name: teamName.trim(),
        _team_join_code: joinCode.trim() || null
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const sessionData = {
        participantId: result.id,
        eventId: result.event_id,
        eventName: result.event_name,
        name: name.trim()
      };
      
      localStorage.setItem("event-presence-session", JSON.stringify(sessionData));
      
      setConfirmed(true);
      setParticipantData(result);
      setSchedule((result.schedule as any) || []);
      setEventName(result.event_name || "");
      
      const { data: evData } = await supabase.from('events').select('is_overnight').eq('id', result.event_id).single();
      if (evData) setIsOvernight(evData.is_overnight);

      toast.success("Presence recorded!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (participantData?.event_id) {
      (supabase as any).from("rooms").select("*").eq("event_id", participantData.event_id).order("name")
        .then(({ data }: any) => { if (data) setRooms(data as Room[]); });
    }
  }, [participantData?.event_id]);

  useEffect(() => {
    if (!confirmed || !participantData?.id) return;

    const channel = supabase
      .channel(`participant-status-${participantData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `id=eq.${participantData.id}`
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.attendance_confirmed) {
            setParticipantData(prev => prev ? { ...prev, attendance_confirmed: true, confirmed_at: updated.confirmed_at } : null);
            toast.success("Attendance confirmed by Admin! 🎉");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [confirmed, participantData?.id]);

  const handleUpdateProfile = async () => {
    if (!participantData) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('participants')
        .update({
          name: name.trim(),
          phone_number: phone.trim()
        } as any)
        .eq('id', participantData.id);

      if (error) throw error;
      
      const saved = localStorage.getItem("event-presence-session");
      if (saved) {
        const newSession = { ...JSON.parse(saved), name: name.trim() };
        localStorage.setItem("event-presence-session", JSON.stringify(newSession));
      }
      
      setParticipantData({ ...participantData, name: name.trim(), phone_number: phone.trim() });
      setIsEditing(false);
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantData?.id) return;
    setIsUpdatingDetails(true);
    try {
      const { error } = await (supabase as any).rpc('update_participant_details', {
        p_id: participantData.id,
        p_room_id: selectedRoom || null,
        p_track: track || null,
        p_github_repo: githubRepo || null,
        p_overnight_stay: overnightStay
      });
      if (error) throw error;
      setParticipantData({ ...participantData, room_id: selectedRoom, track, github_repo: githubRepo, overnight_stay: overnightStay });
      toast.success("Project details saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save details.");
    } finally {
      setIsUpdatingDetails(false);
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
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 890" required />
                </div>
                <div className="pt-2 border-t border-border/50 mt-4">
                  <Label htmlFor="team">Team Name</Label>
                  <Input id="team" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Dream Team" required />
                  <p className="text-[10px] text-muted-foreground mt-1">If you're the first member, no code needed. Others will need your team's join code.</p>
                </div>
                {teamName && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <Label htmlFor="joinCode">Team Join Code</Label>
                    <Input id="joinCode" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} className="uppercase font-mono" />
                  </motion.div>
                )}
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
                  <CheckCircle2 className={`w-8 h-8 ${participantData?.attendance_confirmed ? "text-success" : "text-muted-foreground opacity-50"}`} />
                </div>
                <div className="flex flex-col items-center justify-center gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">
                      {isEditing ? "Edit Your Details" : (participantData?.attendance_confirmed ? "Attendance Confirmed!" : "Presence Recorded!")}
                    </h2>
                    {!isEditing && (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8 w-8 p-0">
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  {!isEditing && (
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${participantData?.attendance_confirmed ? "bg-success/20 text-success border border-success/30" : "bg-warning/20 text-warning border border-warning/30"}`}>
                      {participantData?.attendance_confirmed ? "Confirmed" : "Pending Scan"}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-2">
                  {isEditing 
                    ? "Update your information below." 
                    : (participantData?.attendance_confirmed 
                        ? `Welcome to ${eventName}! Your attendance is officially confirmed.` 
                        : `You've joined ${eventName}. Please show your QR code to an admin to confirm entrance.`)}
                </p>
              </div>

              {!isEditing && participantData?.id && (
                <div className="mb-8 flex flex-col items-center">
                  <div className="bg-white p-3 rounded-2xl shadow-xl border border-primary/10 mb-2">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${participantData.id}`} 
                      alt="Check-in QR"
                      className="w-40 h-40"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Show this QR to Admin</span>
                </div>
              )}

              {participantData?.attendance_confirmed && (
                <div className="mb-8 p-6 rounded-xl bg-card border border-border shadow-md">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Code className="w-4 h-4 text-primary" /> Project Details
                  </h3>
                  <form onSubmit={handleSaveProjectDetails} className="space-y-4 text-left">
                    <div>
                      <Label htmlFor="room" className="flex items-center gap-2 mb-1.5"><MapPin className="w-3.5 h-3.5" /> Room <span className="text-muted-foreground font-normal text-xs">(Ask Organizer)</span></Label>
                      <select id="room" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <option value="">Select a room...</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="track" className="mb-1.5 block">Track</Label>
                      <Input id="track" value={track} onChange={e => setTrack(e.target.value)} placeholder="e.g. AI/ML, Web3..." />
                    </div>
                    <div>
                      <Label htmlFor="github" className="flex items-center gap-2 mb-1.5"><Github className="w-3.5 h-3.5" /> GitHub Repo URL</Label>
                      <Input id="github" type="url" value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="https://github.com/your/repo" />
                    </div>
                    {isOvernight && (
                      <div className="flex items-center space-x-2 pt-2 pb-1 border-t border-border/50">
                        <input type="checkbox" id="overnight" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-background" checked={overnightStay} onChange={e => setOvernightStay(e.target.checked)} />
                        <Label htmlFor="overnight" className="text-sm font-medium leading-none flex items-center gap-2 cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"><Moon className="w-3.5 h-3.5" /> Request Overnight Stay</Label>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isUpdatingDetails}>
                      {isUpdatingDetails ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Details"}
                    </Button>
                  </form>
                </div>
              )}

              {!isEditing && participantData?.team_name && (
                <div className="mb-8 p-4 rounded-xl bg-primary/5 border border-primary/10 text-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users className="w-12 h-12" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Your Team</span>
                  <div className="font-bold text-lg mb-3">{participantData.team_name}</div>
                  
                  <div className="inline-flex flex-col items-center">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Team Join Code</span>
                    <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg border border-primary/20 shadow-sm">
                      <Hash className="w-4 h-4 text-primary" />
                      <code className="text-xl font-mono font-black text-primary tracking-widest">
                        {participantData.team_join_code}
                      </code>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">Share this code with your teammates to join this team!</p>
                  </div>
                </div>
              )}

              {isEditing ? (
                <div className="space-y-4 mb-8 p-6 glass-card border-primary/20">
                  <div>
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Phone Number</Label>
                    <Input id="edit-phone" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleUpdateProfile} className="flex-1 gradient-primary text-primary-foreground" disabled={loading}>
                      <Save className="w-4 h-4 mr-2" /> Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="px-3">
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : participantData?.team_name && (
                <div className="mb-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Team Profile</span>
                      <h4 className="text-lg font-bold">{participantData.team_name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Your Role</span>
                      <p className="text-sm font-semibold capitalize">{participantData.team_role || 'Member'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary/10">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Join Code</span>
                      <p className="font-mono font-bold text-primary flex items-center gap-1.5">
                        <Hash className="w-3 h-3" /> {participantData.team_join_code}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Share This</span>
                      <p className="text-[10px] leading-tight">Give this code to your other team members.</p>
                    </div>
                  </div>
                </div>
              )}

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
