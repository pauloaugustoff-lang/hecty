import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUserSpaces, requireCurrentSpace } from "@/lib/spaces/current-space";
import { AppChrome } from "@/components/layout/app-chrome";
import { Toaster } from "@/components/ui/toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [spaces, currentSpace] = await Promise.all([listUserSpaces(), requireCurrentSpace()]);

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  return (
    <AppChrome
      spaces={spaces}
      currentSpaceId={currentSpace.id}
      userName={profile?.full_name || user.email || ""}
      userEmail={user.email ?? ""}
    >
      {children}
      <Toaster />
    </AppChrome>
  );
}
