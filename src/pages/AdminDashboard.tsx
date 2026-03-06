import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarCheck, ArrowLeft, Copy, Upload, Plus, Trash2, Users, UserCheck, UserX, Moon, Clock, Link as LinkIcon, UserMinus, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Event {
  id: string;
  event_name: string;
  event_date: string;
  event_code: string;
  is_overnight: boolean;
  schedule: Array<{ time: string; title: string }>;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  attendance_confirmed: boolean;
  confirmed_at: string | null;
  overnight_stay: boolean | null;
}

interface Admin {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: {
    name: string | null;
    email: string | null;
  } | null;
}

const AdminDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleInput, setScheduleInput] = useState("");
  const [newScheduleTime, setNewScheduleTime] = useState("");
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }

    const { data: admin } = await supabase
      .from("event_admins")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!admin) { toast.error("Access denied"); navigate("/dashboard"); return; }

    const { data: eventData } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (eventData) setEvent(eventData as unknown as Event);

    const { data: parts } = await supabase.from("participants").select("*").eq("event_id", eventId).order("name");
    setParticipants((parts as Participant[]) || []);

    try {
      const { data: adminList, error: adminError } = await supabase
        .from("event_admins")
        .select("*, profiles:user_id(name, email)")
        .eq("event_id", eventId)
        .order("created_at");

      if (adminError) {
        console.error("Error fetching admins:", adminError);
        // Fallback to fetching without join if it fails
        const { data: simpleAdmins } = await supabase
          .from("event_admins")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at");
        setAdmins((simpleAdmins as unknown as Admin[]) || []);
      } else {
        setAdmins((adminList as unknown as Admin[]) || []);
      }
    } catch (err) {
      console.error("Failed to load admins:", err);
    }

    setLoading(false);
  }, [eventId, navigate]);

  useEffect(() => {
    loadData();

    // Real-time subscription
    const channel = supabase
      .channel(`participants-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `event_id=eq.${eventId}` }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, loadData]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const joinLink = `${window.location.origin}/#/join/${event?.event_code}`;

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const confirmed = filteredParticipants.filter(p => p.attendance_confirmed);
  const notConfirmed = filteredParticipants.filter(p => !p.attendance_confirmed);
  const overnightStay = filteredParticipants.filter(p => p.overnight_stay === true);
  const nonOvernight = confirmed.filter(p => p.overnight_stay !== true);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const newParticipants = rows
        .filter(r => r.Name && r.Email)
        .map(r => ({
          event_id: eventId!,
          name: String(r.Name).trim(),
          email: String(r.Email).trim().toLowerCase(),
        }));

      if (!newParticipants.length) {
        toast.error("No valid rows found. Ensure columns are 'Name' and 'Email'.");
        return;
      }

      const { error } = await supabase.from("participants").upsert(newParticipants, { onConflict: "event_id,email" });
      if (error) throw error;
      toast.success(`${newParticipants.length} participants uploaded!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
    e.target.value = "";
  };

  const removeParticipant = async (id: string) => {
    await supabase.from("participants").delete().eq("id", id);
    loadData();
  };

  const toggleOvernight = async (id: string, current: boolean | null) => {
    await supabase.from("participants").update({ overnight_stay: !current }).eq("id", id);
    loadData();
  };

  const addScheduleItem = async () => {
    if (!newScheduleTime || !newScheduleTitle || !event) return;
    try {
      const updated = [...(event.schedule || []), { time: newScheduleTime, title: newScheduleTitle }];
      const { error } = await supabase.from("events").update({ schedule: updated as any }).eq("id", event.id);

      if (error) throw error;

      setEvent({ ...event, schedule: updated });
      setNewScheduleTime("");
      setNewScheduleTitle("");
      toast.success("Schedule item added!");
    } catch (err: any) {
      console.error("Error adding schedule item:", err);
      toast.error(err.message || "Failed to add schedule item");
    }
  };

  const removeScheduleItem = async (index: number) => {
    if (!event) return;
    try {
      const updated = event.schedule.filter((_, i) => i !== index);
      const { error } = await supabase.from("events").update({ schedule: updated as any }).eq("id", event.id);

      if (error) throw error;

      setEvent({ ...event, schedule: updated });
      toast.success("Schedule item removed");
    } catch (err: any) {
      console.error("Error removing schedule item:", err);
      toast.error(err.message || "Failed to remove schedule item");
    }
  };

  const removeAdmin = async (id: string) => {
    if (admins.length <= 1) {
      toast.error("Cannot remove the last administrator");
      return;
    }
    const { error } = await supabase.from("event_admins").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Administrator removed");
    loadData();
  };

  const createAdminInvite = async () => {
    if (!event) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase.from("admin_invites").insert({
      event_id: event.id,
      created_by: session.user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    const link = `${window.location.origin}/#/admin-invite/${(data as any).invite_code}`;
    copyToClipboard(link, "Admin invite link");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  if (!event) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2 truncate px-2">
            <div className="flex flex-col items-center">
              <span className="font-bold truncate">{event.event_name}</span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none">by DevX</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(event.event_date), "MMM d")}</div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Quick Info Bar */}
        <div className="glass-card rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Event Code</span>
              <button onClick={() => copyToClipboard(event.event_code, "Event code")} className="font-mono text-lg font-bold text-primary hover:underline flex items-center gap-1.5">
                {event.event_code} <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Join Link</span>
              <button onClick={() => copyToClipboard(joinLink, "Join link")} className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" /> Copy Link
              </button>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Invite Admin</span>
              <button onClick={createAdminInvite} className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Generate Link
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-success" />
              <span className="font-semibold">{confirmed.length}</span>
              <span className="text-muted-foreground">confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserX className="w-4 h-4 text-destructive" />
              <span className="font-semibold">{notConfirmed.length}</span>
              <span className="text-muted-foreground">pending</span>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search participants by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 transition-colors"
          />
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="mb-4 w-full justify-start overflow-x-auto no-scrollbar flex-nowrap bg-transparent gap-2 h-auto p-0">
            <TabsTrigger value="participants" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><Users className="w-4 h-4 mr-2" /> Participants</TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><Clock className="w-4 h-4 mr-2" /> Schedule</TabsTrigger>
            <TabsTrigger value="admins" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><UserCheck className="w-4 h-4 mr-2" /> Admins</TabsTrigger>
            {event.is_overnight && <TabsTrigger value="overnight" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><Moon className="w-4 h-4 mr-2" /> Overnight</TabsTrigger>}
          </TabsList>

          <TabsContent value="participants">
            <div className="mb-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="w-4 h-4 mr-1" /> Upload CSV/XLSX</span>
                </Button>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {/* Confirmed */}
            <div className="mb-6">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-success" /> Confirmed ({confirmed.length})
              </h3>
              {confirmed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No confirmations yet.</p>
              ) : (
                <div className="glass-card rounded-xl overflow-x-auto no-scrollbar">
                  <table className="w-full text-sm min-w-full">
                    <thead><tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Confirmed At</th>
                      <th className="p-3"></th>
                    </tr></thead>
                    <tbody>
                      {confirmed.map(p => (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="p-3">{p.name}</td>
                          <td className="p-3 text-muted-foreground">{p.email}</td>
                          <td className="p-3 text-muted-foreground">{p.confirmed_at ? format(new Date(p.confirmed_at), "MMM d, h:mm a") : "-"}</td>
                          <td className="p-3"><Button variant="ghost" size="sm" onClick={() => removeParticipant(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Not Confirmed */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <UserX className="w-4 h-4 text-destructive" /> Not Confirmed ({notConfirmed.length})
              </h3>
              {notConfirmed.length === 0 ? (
                <p className="text-sm text-muted-foreground">All participants confirmed or no participants uploaded.</p>
              ) : (
                <div className="glass-card rounded-xl overflow-x-auto no-scrollbar">
                  <table className="w-full text-sm min-w-full">
                    <thead><tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="p-3"></th>
                    </tr></thead>
                    <tbody>
                      {notConfirmed.map(p => (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="p-3">{p.name}</td>
                          <td className="p-3 text-muted-foreground">{p.email}</td>
                          <td className="p-3"><Button variant="ghost" size="sm" onClick={() => removeParticipant(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-semibold mb-4">Event Schedule</h3>
              <div className="space-y-2 mb-6">
                {(event.schedule || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex gap-3">
                      <span className="font-mono text-primary font-medium">{item.time}</span>
                      <span>{item.title}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeScheduleItem(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
                {(!event.schedule || event.schedule.length === 0) && <p className="text-muted-foreground text-sm">No schedule items yet.</p>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="09:00 AM" value={newScheduleTime} onChange={e => setNewScheduleTime(e.target.value)} className="w-32" />
                <Input placeholder="Registration" value={newScheduleTitle} onChange={e => setNewScheduleTitle(e.target.value)} className="flex-1" />
                <Button onClick={addScheduleItem} className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="admins">
            <div className="glass-card rounded-xl overflow-x-auto no-scrollbar">
              <table className="w-full text-sm min-w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Joined At</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => (
                    <tr key={admin.id} className="border-b border-border/50">
                      <td className="p-3 font-medium">
                        {admin.profiles?.name || admin.profiles?.email || <span className="text-muted-foreground font-mono text-[10px]">{admin.user_id}</span>}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {admin.profiles?.name ? admin.profiles.email : "-"}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs capitalize">
                          {admin.role}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {format(new Date(admin.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAdmin(admin.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4 px-1">
              Note: You can add more administrators by generating an invite link in the quick info bar above.
            </p>
          </TabsContent>

          {event.is_overnight && (
            <TabsContent value="overnight">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Moon className="w-4 h-4" /> Staying Overnight ({overnightStay.length})</h3>
                  {overnightStay.length === 0 ? <p className="text-sm text-muted-foreground">No one assigned yet.</p> : (
                    <div className="space-y-2">
                      {overnightStay.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm">
                          <span>{p.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => toggleOvernight(p.id, true)}>Move out</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="glass-card rounded-xl p-5">
                  <h3 className="font-semibold mb-3">Not Staying ({nonOvernight.length})</h3>
                  {confirmed.filter(p => p.overnight_stay !== true).length === 0 ? <p className="text-sm text-muted-foreground">No participants to show.</p> : (
                    <div className="space-y-2">
                      {confirmed.filter(p => p.overnight_stay !== true).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm">
                          <span>{p.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => toggleOvernight(p.id, p.overnight_stay)}>Add to overnight</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <footer className="mt-auto py-8 border-t border-border bg-card">
        <div className="container mx-auto px-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => window.open('https://devxgtbit.netlify.app', '_blank')}>
            <img src="/devx-logo.png" alt="" className="w-5 h-5 object-contain" onError={e => e.currentTarget.style.display = 'none'} />
            <span className="text-xs font-bold uppercase tracking-widest text-foreground">Made with ❤️ by <span className="text-primary italic">DevX</span></span>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">EventPresence • Professional Event Management</p>
        </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;
