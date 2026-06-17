import type { DashboardNav } from "../../types/dashboardTypes";
import { AppIcon } from "../ui/AppIcon";
import { DashboardNavItem, type DashboardNavItemConfig } from "./DashboardNavItem";

const NAVIGATION_ITEMS: DashboardNavItemConfig[] = [
  { id: "home", icon: "home", label: "Beranda", mobileLabel: "Beranda" },
  { id: "explore", icon: "sparkles", label: "Jelajahi", mobileLabel: "Jelajahi" },
  { id: "collection", icon: "bookmark", label: "Koleksi Belajar", mobileLabel: "Koleksi" },
  { id: "test-space", icon: "simulation", label: "Ruang Uji", mobileLabel: "Uji" },
  { id: "progress", icon: "analytics", label: "Perkembangan", mobileLabel: "Progres" },
];

export function DashboardTopNavigation({
  activeNav,
  onNavigate,
}: {
  activeNav: DashboardNav;
  onNavigate: (destination: DashboardNav) => void;
}) {
  return (
    <header className="appTopNavigation arcane-header">
      <button
        className="appTopBrand arcane-logo"
        aria-label="Kembali ke Beranda"
        type="button"
        onClick={() => onNavigate("home")}
      >
        <span className="appTopBrandLogo arcane-logo-mark" aria-hidden="true">
          <AppIcon name="reading" />
        </span>
        <span className="arcane-logo-text">
          <strong className="arcane-logo-main">TOEFL Gratis</strong>
          <small className="arcane-logo-sub">Platform Yang Disusun Oleh Ibnu Hakim</small>
        </span>
      </button>

      <nav className="appNavigation arcane-nav" aria-label="Navigasi utama">
        {NAVIGATION_ITEMS.map((item) => (
          <DashboardNavItem
            active={activeNav === item.id}
            item={item}
            key={item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      <span className="appTopTrust arcane-badge arcane-badge-validated arcane-validated-badge">
        <AppIcon name="check" />
        Bank tervalidasi
      </span>
    </header>
  );
}
