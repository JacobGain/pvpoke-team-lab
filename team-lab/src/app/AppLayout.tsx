import {
  Archive,
  BookOpen,
  Boxes,
  FlaskConical,
  HeartPulse,
  Home,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { usePvpokeDataStatus } from "@/features/meta/usePvpokeDataStatus";

interface NavigationItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly end: boolean;
}

const primaryNavigation = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/inventory", label: "Inventory", icon: Boxes, end: false },
  { to: "/teams", label: "Teams", icon: Users, end: false },
  { to: "/recommend", label: "Recommend", icon: Sparkles, end: false },
] as const satisfies readonly NavigationItem[];

const utilityNavigation = [
  {
    to: "/catalog",
    label: "Great League catalog",
    icon: BookOpen,
    end: false,
  },
  {
    to: "/inventory/backup",
    label: "Local data",
    icon: Archive,
    end: false,
  },
  {
    to: "/diagnostics/simulation",
    label: "Engine diagnostics",
    icon: HeartPulse,
    end: false,
  },
] as const satisfies readonly NavigationItem[];

function NavigationLink({
  to,
  label,
  icon: Icon,
  end = false,
  onNavigate,
}: {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly end?: boolean;
  readonly onNavigate?: () => void;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        `app-nav__link${isActive ? " app-nav__link--active" : ""}`
      }
      end={end}
      onClick={onNavigate}
      to={to}
    >
      <Icon aria-hidden="true" size={19} strokeWidth={2.1} />
      <span>{label}</span>
    </NavLink>
  );
}

export function AppLayout() {
  const location = useLocation();
  const { data, error, isLoading } = usePvpokeDataStatus();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0, behavior: "instant" });
  }, [location.pathname]);

  const dataState = isLoading ? "loading" : error || !data ? "error" : "ready";

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="app-topbar">
        <div className="app-topbar__inner">
          <NavLink className="brand-mark" to="/" aria-label="TeamLab dashboard">
            <span className="brand-mark__icon" aria-hidden="true">
              <FlaskConical size={23} strokeWidth={2.2} />
            </span>
            <span className="brand-mark__copy">
              <strong>TeamLab</strong>
              <small>Open Great League</small>
            </span>
          </NavLink>

          <nav className="app-nav app-nav--desktop" aria-label="Primary">
            {primaryNavigation.map((item) => (
              <NavigationLink key={item.to} {...item} />
            ))}
          </nav>

          <div className="app-topbar__tools">
            <NavLink
              className={`data-health data-health--${dataState}`}
              to="/diagnostics/simulation"
              title={
                dataState === "ready"
                  ? `PvPoke connected · ${data?.gameMasterTitle}`
                  : "Check PvPoke data connection"
              }
            >
              <span aria-hidden="true" />
              <ShieldCheck size={16} />
              <strong>
                {dataState === "loading"
                  ? "Connecting"
                  : dataState === "ready"
                    ? "Data ready"
                    : "Data issue"}
              </strong>
            </NavLink>
            <button
              aria-controls="mobile-menu"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="icon-button app-menu-button"
              onClick={() => {
                setMenuOpen((isOpen) => !isOpen);
              }}
              type="button"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mobile-menu${menuOpen ? " mobile-menu--open" : ""}`}
        id="mobile-menu"
      >
        <nav aria-label="More TeamLab destinations">
          <p className="mobile-menu__label">Explore and manage</p>
          {utilityNavigation.map((item) => (
            <NavigationLink
              key={item.to}
              {...item}
              onNavigate={() => {
                setMenuOpen(false);
              }}
            />
          ))}
        </nav>
      </div>

      <div className="app-content" id="main-content">
        <Outlet />
      </div>

      <nav className="mobile-tabbar" aria-label="Primary mobile navigation">
        {primaryNavigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            className={({ isActive }) =>
              `mobile-tabbar__link${isActive ? " mobile-tabbar__link--active" : ""}`
            }
            end={end}
            key={to}
            onClick={() => {
              setMenuOpen(false);
            }}
            to={to}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={2.1} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          aria-expanded={menuOpen}
          className={menuOpen ? "mobile-tabbar__link mobile-tabbar__link--active" : "mobile-tabbar__link"}
          onClick={() => {
            setMenuOpen((isOpen) => !isOpen);
          }}
          type="button"
        >
          <Menu aria-hidden="true" size={20} strokeWidth={2.1} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
