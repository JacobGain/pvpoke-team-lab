import { useLeague } from "@/features/leagues/leagueStore";
import { LeagueSelector, LeagueName } from "@/features/leagues/LeagueSelector";
import {
  Archive,
  BookOpen,
  Boxes,
  FlaskConical,
  Home,
  Menu,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

interface NavigationItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly end: boolean;
}

const mobilePrimaryNavigation = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/inventory", label: "Inventory", icon: Boxes, end: false },
  { to: "/teams", label: "Teams", icon: Users, end: false },
  { to: "/recommend", label: "Find", icon: Sparkles, end: false },
] as const satisfies readonly NavigationItem[];

const desktopPrimaryNavigation = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/inventory", label: "Inventory", icon: Boxes, end: false },
  { to: "/catalog", label: "Rankings", icon: BookOpen, end: false },
  { to: "/teams", label: "Teams", icon: Users, end: false },
  { to: "/recommend", label: "Recommend", icon: Sparkles, end: false },
] as const satisfies readonly NavigationItem[];

const utilityNavigation: readonly NavigationItem[] = [
  {
    to: "/catalog",
    label: "Rankings",
    icon: BookOpen,
    end: false,
  },
  {
    to: "/inventory/backup",
    label: "Backups & reset",
    icon: Archive,
    end: false,
  },
];

const SITE_ORIGIN = "https://pogoteamlab.com";
const publicSeo = {
  home: {
    title: "Pokémon GO PvP Team Builder & Roster Planner | TeamLab",
    description:
      "Track your Pokémon GO PvP roster, compare current Great, Ultra, and Master League rankings, and build teams from the Pokémon you own.",
  },
  rankings: {
    title: "Pokémon GO PvP Rankings | TeamLab",
    description:
      "Explore current Pokémon GO PvP rankings, recommended moves, matchups, and optimal IVs for Great, Ultra, and Master League.",
  },
} as const;

function setMeta(name: string, content: string, attribute = "name") {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${name}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.append(element);
  }
  element.content = content;
}

function updateSeoMetadata(pathname: string) {
  const isHome = pathname === "/";
  const isRankings = pathname === "/catalog";
  const seo = isRankings ? publicSeo.rankings : publicSeo.home;
  const isPublic = isHome || isRankings;
  const canonicalPath = isRankings ? "/catalog" : "/";

  document.title = isPublic ? seo.title : `TeamLab | Pokémon GO PvP`;
  setMeta("description", seo.description);
  setMeta("robots", isPublic ? "index, follow" : "noindex, nofollow");
  setMeta("og:title", document.title, "property");
  setMeta("og:description", seo.description, "property");
  setMeta("og:url", `${SITE_ORIGIN}${canonicalPath}`, "property");
  setMeta("twitter:title", document.title);
  setMeta("twitter:description", seo.description);

  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!isPublic) {
    canonical?.remove();
    return;
  }
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = `${SITE_ORIGIN}${canonicalPath}`;
}

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
  const league = useLeague();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0, behavior: "instant" });
    updateSeoMetadata(location.pathname);
  }, [location.pathname]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="app-rail">
        <NavLink
          aria-label="TeamLab dashboard"
          className="brand-mark brand-mark--rail"
          to="/"
        >
          <span className="brand-mark__icon" aria-hidden="true">
            <FlaskConical size={25} strokeWidth={2.2} />
          </span>
          <span className="brand-mark__copy">
            <strong>TeamLab</strong>
            <small>Pokémon GO PvP</small>
          </span>
        </NavLink>

        <div className="app-rail__format">
          <LeagueSelector />
        </div>

        <nav className="app-nav app-nav--rail" aria-label="Primary">
          <p className="app-rail__label">Workspace</p>
          {desktopPrimaryNavigation.map((item) => (
            <NavigationLink key={item.to} {...item} />
          ))}
        </nav>

        <nav className="app-nav app-nav--rail app-nav--utility" aria-label="Tools">
          <p className="app-rail__label">Manage</p>
          {utilityNavigation.slice(1).map((item) => (
            <NavigationLink key={item.to} {...item} />
          ))}
        </nav>

        <div className="app-rail__footer">
          <small>Inventory and team-planning workspace</small>
        </div>
      </aside>

      <header className="app-topbar app-topbar--mobile">
        <div className="app-topbar__inner">
          <NavLink className="brand-mark" to="/" aria-label="TeamLab dashboard">
            <span className="brand-mark__icon" aria-hidden="true">
              <FlaskConical size={23} strokeWidth={2.2} />
            </span>
            <span className="brand-mark__copy">
              <strong>TeamLab</strong>
              <small><LeagueName open /></small>
            </span>
          </NavLink>

          <div className="app-topbar__tools">
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
          <LeagueSelector onSelect={() => setMenuOpen(false)} />
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
        <Outlet key={league.id} />
        <footer className="app-footer">
          <div className="app-footer__inner">
            <div className="app-footer__identity">
              <FlaskConical aria-hidden="true" size={20} />
              <span>
                <strong>TeamLab</strong>
                <small>Independent battle-planning tool</small>
              </span>
            </div>
            <div className="app-footer__legal">
              <p>
                Pokémon and Pokémon GO are copyright of The Pokémon Company,
                Niantic, Inc., and Nintendo. All trademarked images and names
                are property of their respective owners and are used here for
                educational and informational purposes only. TeamLab is an
                independent, unofficial project and is not affiliated with or
                endorsed by The Pokémon Company, Niantic, Inc., Nintendo, or
                PvPoke LLC.
              </p>
              <p>
                Battle data and simulation foundations are derived from{" "}
                <a href="https://pvpoke.com/" rel="noreferrer" target="_blank">
                  PvPoke
                </a>{" "}
                and used under its{" "}
                <a
                  href="https://github.com/pvpoke/pvpoke/blob/master/LICENSE"
                  rel="noreferrer"
                  target="_blank"
                >
                  MIT License
                </a>
                .
              </p>
            </div>
          </div>
        </footer>
      </div>

      <nav className="mobile-tabbar" aria-label="Primary mobile navigation">
        {mobilePrimaryNavigation.map(({ to, label, icon: Icon, end }) => (
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
