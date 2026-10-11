"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import ChatWidget from "@/components/ChatWidget";
import { BottomBar, MobileHeader, SidePanel } from "@/components/meter/BreakerNav";
import { getSupabase } from "@/lib/supabase/client";

const DeviceContext = createContext(null);
export const useDevice = () => useContext(DeviceContext);

// Dashboard frame: loads the user and their device once and shares them, then
// wraps every page in the breaker-panel nav (dashboard-design.md §3).
export default function Shell({ children }) {
  const router = useRouter();
  const [state, setState] = useState({ user: null, device: null, ready: false });

  useEffect(() => {
    const supabase = getSupabase();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      // RLS returns only this user's device.
      const { data: device } = await supabase.from("devices").select("id, name, link_code").maybeSingle();
      if (!device) return router.replace("/link");
      setState({ user, device, ready: true });
    })();
  }, [router]);

  return (
    <DeviceContext.Provider value={state}>
      <div className="mx-auto flex min-h-screen max-w-[1400px] gap-4 p-3 pb-20 sm:p-5 md:pb-5">
        <div className="sticky top-5 hidden h-[calc(100vh-2.5rem)] md:block">
          <SidePanel user={state.user} device={state.device} router={router} />
        </div>

        <main className="min-w-0 flex-1">
          <MobileHeader user={state.user} device={state.device} router={router} />
          {state.ready ? children : <div className="skeleton h-[60vh] w-full rounded-md" />}
        </main>
      </div>
      <BottomBar />
      {state.ready && <ChatWidget />}
    </DeviceContext.Provider>
  );
}
