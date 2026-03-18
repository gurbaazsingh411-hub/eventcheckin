import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarCheck, ArrowLeft, Copy, Upload, Plus, Trash2, Users, UserCheck, UserX, Moon, Clock, Link as LinkIcon, UserMinus, Search, Edit2, XCircle, QrCode, Camera, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import QrScanner from "@/components/QrScanner";

interface EventType {
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
  phone_number?: string;
  team_id?: string;
  team_role?: string;
  teams?: { name: string; join_code: string } | null;
}

interface Team {
  id: string;
  name: string;
  join_code: string;
}

interface Room {
  id: string;
  name: string;
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
  const [event, setEvent] = useState<EventType | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleInput, setScheduleInput] = useState("");
  const [newScheduleTime, setNewScheduleTime] = useState("");
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const [newParticipantPhone, setNewParticipantPhone] = useState("");
  const [newParticipantTeam, setNewParticipantTeam] = useState("");

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
    if (eventData) setEvent(eventData as unknown as EventType);

    const { data: parts } = await (supabase as any).from("participants").select("*, teams(name, join_code)").eq("event_id", eventId).order("name") as any;
    setParticipants((parts as any[]) || []);

    const { data: teamList } = await (supabase as any).from("teams").select("*").eq("event_id", eventId).order("name") as any;
    setTeams((teamList as any[]) || []);

    const { data: roomList } = await (supabase as any)
      .from("rooms")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");
    setRooms((roomList as any[]) || []);

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
    const channel = (supabase as any)
      .channel(`admin-updates-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `event_id=eq.${eventId}` }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `event_id=eq.${eventId}` }, () => {
        loadData();
      })
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

      // Distinguish between Participant upload and Team upload
      const isTeamUpload = rows.length > 0 && (rows[0].Team || rows[0]['Team Name']);

      if (isTeamUpload) {
        const newTeams = rows
          .filter(r => (r.Team || r['Team Name']))
          .map(r => ({
            event_id: eventId!,
            name: String(r.Team || r['Team Name']).trim(),
            join_code: Math.random().toString(36).substring(2, 8).toUpperCase()
          }));

        if (!newTeams.length) {
          toast.error("No valid team names found.");
          return;
        }

        const { error } = await (supabase as any).from("teams").insert(newTeams);
        if (error) throw error;
        toast.success(`Uploaded ${newTeams.length} teams`);
      } else {
        const newParticipants = rows
          .filter(r => r.Name && r.Email)
          .map(r => ({
            event_id: eventId!,
            name: String(r.Name).trim(),
            email: String(r.Email).trim().toLowerCase(),
          }));

        if (!newParticipants.length) {
          toast.error("No valid rows found. Ensure columns are 'Name' and 'Email' (or 'Team' for teams).");
          return;
        }

        const { error } = await supabase.from("participants").upsert(newParticipants, { onConflict: "event_id,email" });
        if (error) throw error;
        toast.success(`Uploaded ${newParticipants.length} participants`);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
    e.target.value = "";
  };

  const handleUpdateParticipant = async (pId: string, updates: any) => {
    try {
      const { error } = await supabase.from("participants").update(updates).eq("id", pId);
      if (error) throw error;
      toast.success("Participant updated");
      setEditingParticipant(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  const removeTeam = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("teams").delete().eq("id", id);
      if (error) throw error;
      toast.success("Team removed");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
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

  const handleAddTeam = async () => {
    if (!event || !newTeamName.trim()) return;
    try {
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase.from("teams" as any).insert([{ 
        event_id: event.id, 
        name: newTeamName.trim(),
        join_code: joinCode
      }]);
      if (error) throw error;
      toast.success("Team added!");
      setNewTeamName("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add team");
    }
  };

  const handleAddRoom = async () => {
    if (!event || !newRoomName.trim()) return;
    try {
      const { error } = await (supabase as any).from("rooms").insert([{ 
        event_id: event.id, 
        name: newRoomName.trim()
      }]);
      if (error) throw error;
      toast.success("Room added!");
      setNewRoomName("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add room");
    }
  };

  const removeRoom = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("rooms").delete().eq("id", id);
      if (error) throw error;
      toast.success("Room removed");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove room");
    }
  };

  const handleAddParticipant = async () => {
    if (!event || !newParticipantName.trim() || !newParticipantEmail.trim() || !newParticipantTeam.trim()) {
      toast.error("Please fill in all fields including Team Name.");
      return;
    }
    try {
      let teamId = null;
      if (newParticipantTeam.trim()) {
        const team = teams.find(t => t.name.toLowerCase() === newParticipantTeam.trim().toLowerCase());
        if (!team) {
          toast.error("Team not found. Please create the team first.");
          return;
        }
        teamId = team.id;
      }

      const { error } = await supabase.from("participants").insert([{
        event_id: event.id,
        name: newParticipantName.trim(),
        email: newParticipantEmail.trim(),
        phone_number: newParticipantPhone.trim() || null,
        team_id: teamId,
        attendance_confirmed: false,
        confirmed_at: null
      }]);
      if (error) throw error;
      toast.success("Participant added!");
      setNewParticipantName("");
      setNewParticipantEmail("");
      setNewParticipantPhone("");
      setNewParticipantTeam("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add participant");
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

  const handleScan = async (participantId: string) => {
    try {
      // Basic validation of the scanned ID format (UUID check)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(participantId)) {
        toast.error("Invalid QR code scanned.");
        setIsScanning(false);
        return;
      }

      const participant = participants.find(p => p.id === participantId);
      if (!participant) {
        toast.error("Participant not found for this event.");
        setIsScanning(false);
        return;
      }

      if (participant.attendance_confirmed) {
        toast.info(`${participant.name} is already confirmed.`);
        setIsScanning(false);
        return;
      }

      const { error } = await supabase
        .from("participants")
        .update({ attendance_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("id", participantId);

      if (error) throw error;

      toast.success(`Check-in successful: ${participant.name}`);
      setIsScanning(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to process check-in");
      setIsScanning(false);
    }
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
            <Button 
              onClick={() => setIsScanning(true)} 
              variant="default" 
              size="sm" 
              className="gradient-primary text-primary-foreground h-9 gap-2 shadow-lg shadow-primary/20"
            >
              <Camera className="w-4 h-4" />
              Scan Attendance
            </Button>
            <div className="flex items-center gap-1.5 pl-4 border-l border-border/50">
              <UserCheck className="w-4 h-4 text-success" />
              <span className="font-semibold">{confirmed.length}</span>
              <span className="text-muted-foreground underline decoration-success/30 underline-offset-4 decoration-dotted">confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserX className="w-4 h-4 text-destructive" />
              <span className="font-semibold">{notConfirmed.length}</span>
              <span className="text-muted-foreground underline decoration-destructive/30 underline-offset-4 decoration-dotted">pending</span>
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
            <TabsTrigger value="teams" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><Users className="w-4 h-4 mr-2" /> Teams</TabsTrigger>
            <TabsTrigger value="rooms" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><DoorOpen className="w-4 h-4 mr-2" /> Rooms</TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><Clock className="w-4 h-4 mr-2" /> Schedule</TabsTrigger>
            <TabsTrigger value="admins" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><UserCheck className="w-4 h-4 mr-2" /> Admins</TabsTrigger>
            {event.is_overnight && <TabsTrigger value="overnight" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 py-2 px-4 shadow-none"><Moon className="w-4 h-4 mr-2" /> Overnight</TabsTrigger>}
          </TabsList>

          <TabsContent value="participants">
            <div className="mb-4 flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                <Input placeholder="Name" value={newParticipantName} onChange={e => setNewParticipantName(e.target.value)} />
                <Input placeholder="Email" type="email" value={newParticipantEmail} onChange={e => setNewParticipantEmail(e.target.value)} />
                <Input placeholder="Team Name" value={newParticipantTeam} onChange={e => setNewParticipantTeam(e.target.value)} />
                <Button onClick={handleAddParticipant} className="gradient-primary text-primary-foreground whitespace-nowrap"><Plus className="w-4 h-4 mr-1"/> Add</Button>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span><Upload className="w-4 h-4 mr-1" /> Import CSV</span>
                  </Button>
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
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
                      <th className="text-left p-3 font-medium">Team</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Room</th>
                      <th className="text-left p-3 font-medium">Track</th>
                      <th className="text-left p-3 font-medium">Repo</th>
                      <th className="text-left p-3 font-medium">Confirmed At</th>
                      <th className="p-3"></th>
                    </tr></thead>
                    <tbody>
                      {(confirmed as any[]).map(p => (
                        <tr key={p.id} className="border-b border-border/50 group">
                          <td className="p-3">
                            <span className="font-medium text-foreground">{p.name}</span>
                          </td>
                          <td className="p-3">
                            {p.teams ? <span className="bg-primary/5 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase">{p.teams.name}</span> : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="p-3">
                            <span className="capitalize text-xs">{p.team_role || 'Member'}</span>
                          </td>
                          <td className="p-3 text-muted-foreground">{p.email}</td>
                          <td className="p-3">
                            <span className="font-medium">{rooms.find((r: any) => r.id === p.room_id)?.name || "-"}</span>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{p.track || "-"}</td>
                          <td className="p-3">
                            {p.github_repo ? (
                              <a href={p.github_repo} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                                <LinkIcon className="w-3 h-3" /> Link
                              </a>
                            ) : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="p-3 text-muted-foreground">{p.confirmed_at ? format(new Date(p.confirmed_at), "MMM d, h:mm a") : "-"}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" onClick={() => setEditingParticipant(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => removeParticipant(p.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </td>
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

          <TabsContent value="teams">
            <div className="mb-4 flex flex-col sm:flex-row gap-4 items-end justify-between">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <Input placeholder="New Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()} />
                <Button onClick={handleAddTeam} className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Add</Button>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild className="border-primary/20 hover:bg-primary/5">
                  <span><Upload className="w-4 h-4 mr-1" /> Import CSV</span>
                </Button>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams created yet. Participants will create teams as they join, or you can upload a list above.</p>
            ) : (
              <div className="glass-card rounded-xl overflow-x-auto no-scrollbar">
                <table className="w-full text-sm min-w-full">
                  <thead><tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium">Team Name</th>
                    <th className="text-left p-3 font-medium">Join Code</th>
                    <th className="p-3"></th>
                  </tr></thead>
                  <tbody>
                    {teams.map(t => (
                      <tr key={t.id} className="border-b border-border/50 group">
                        <td className="p-3 font-medium">{t.name}</td>
                        <td className="p-3">
                          <code className="bg-primary/5 text-primary px-2 py-1 rounded font-mono font-bold">{t.join_code}</code>
                        </td>
                        <td className="p-3 text-right">
                           <Button variant="ghost" size="sm" onClick={() => removeTeam(t.id)} className="text-destructive group-hover:opacity-100 opacity-0 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="rooms">
            <div className="mb-4 flex flex-col sm:flex-row gap-4 items-end justify-between">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <Input placeholder="New Room Name" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()} />
                <Button onClick={handleAddRoom} className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Add</Button>
              </div>
            </div>

            {rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rooms created yet. Add a room to allow participants to select it.</p>
            ) : (
              <div className="glass-card rounded-xl overflow-x-auto no-scrollbar">
                <table className="w-full text-sm min-w-full">
                  <thead><tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium">Room Name</th>
                    <th className="p-3"></th>
                  </tr></thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.id} className="border-b border-border/50 group">
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3 text-right">
                           <Button variant="ghost" size="sm" onClick={() => removeRoom(r.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
      <AnimatePresence>
        {editingParticipant && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-md p-6 shadow-2xl border-primary/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Edit Participant</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditingParticipant(null)}><XCircle className="w-4 h-4" /></Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Full Name</Label>
                  <Input 
                    value={editingParticipant.name} 
                    onChange={e => setEditingParticipant({ ...editingParticipant, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input 
                    value={editingParticipant.phone_number || ""} 
                    onChange={e => setEditingParticipant({ ...editingParticipant, phone_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <select 
                    className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={editingParticipant.team_role || "member"}
                    onChange={e => setEditingParticipant({ ...editingParticipant, team_role: e.target.value })}
                  >
                    <option value="member">Member</option>
                    <option value="leader">Leader</option>
                    <option value="admin">Admin (Event)</option>
                  </select>
                </div>
                
                <div className="pt-4 flex gap-2">
                  <Button 
                    className="flex-1 gradient-primary text-primary-foreground"
                    onClick={() => handleUpdateParticipant(editingParticipant.id, {
                      name: editingParticipant.name,
                      phone_number: editingParticipant.phone_number,
                      team_role: editingParticipant.team_role
                    })}
                  >
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingParticipant(null)}>Cancel</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-sm p-6 shadow-2xl border-primary/20 relative"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">Scan QR Code</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsScanning(false)} className="h-8 w-8 p-0">
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>

              <div className="mb-6">
                <QrScanner onScanSuccess={handleScan} />
              </div>

              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setIsScanning(false)}
              >
                Close Scanner
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
