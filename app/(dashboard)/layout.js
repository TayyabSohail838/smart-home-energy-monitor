import Shell from "@/components/Shell";

// The dashboard depends on the logged-in user, so there is no static shell to
// prerender: opt out of Next 16's instant-navigation validation (dev-only check).
export const instant = false;

// Every dashboard page (Overview, Usage, Forecast, Alerts) sits inside the sidebar shell.
export default function DashboardLayout({ children }) {
  return <Shell>{children}</Shell>;
}
