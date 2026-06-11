import { useLocation } from "wouter";
import { LayoutDashboard, CalendarDays, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
];

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  desktop,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  desktop?: boolean;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(href)}
      className={cn(
        "flex items-center gap-3 font-medium transition-all duration-150 cursor-pointer",
        desktop
          ? cn(
              "w-full px-3 py-2.5 rounded-lg text-sm",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )
          : cn(
              "flex-col gap-1 flex-1 py-2 text-xs",
              active ? "text-primary" : "text-muted-foreground"
            )
      )}
    >
      <Icon
        className={cn(
          desktop ? "w-4 h-4 shrink-0" : "w-5 h-5",
          !desktop && active && "text-primary"
        )}
      />
      <span>{label}</span>
    </button>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-card h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground leading-tight">
            Office Tracker
          </span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {nav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location === item.href}
              desktop
            />
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">{new Date().getFullYear()} attendance</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-2.5 px-4 py-3.5 border-b border-border bg-card sticky top-0 z-20">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">Office Tracker</span>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-20 flex items-center px-2 safe-area-bottom">
          {nav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location === item.href}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
