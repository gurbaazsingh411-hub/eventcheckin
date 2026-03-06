import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";

const AdminInvite = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "needsAuth" | "accepting" | "done">("loading");

  useEffect(() => {
    const accept = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("needsAuth");
        // Store invite code to process after login
        sessionStorage.setItem("pendingAdminInvite", inviteCode || "");
        navigate("/auth");
        return;
      }

      setStatus("accepting");
      // Find the invite
      const { data: invite } = await supabase
        .from("admin_invites")
        .select("*")
        .eq("invite_code", inviteCode)
        .is("used_by", null)
        .single();

      if (!invite) {
        toast.error("Invalid or expired invite link");
        navigate("/dashboard");
        return;
      }

      // Accept invite
      await supabase.from("admin_invites").update({
        used_by: session.user.id,
        used_at: new Date().toISOString(),
      }).eq("id", (invite as any).id);

      // Add as admin
      await supabase.from("event_admins").insert({
        event_id: (invite as any).event_id,
        user_id: session.user.id,
      });

      toast.success("You've been added as an admin!");
      navigate(`/admin/${(invite as any).event_id}`);
    };

    accept();
  }, [inviteCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
          <CalendarCheck className="w-6 h-6 text-primary-foreground" />
        </div>
        <p className="text-muted-foreground">Processing invite...</p>
      </div>
    </div>
  );
};

export default AdminInvite;
