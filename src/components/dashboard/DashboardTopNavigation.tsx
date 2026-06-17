import { useState } from "react";
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
  canClose = false,
  onClose,
  onNavigate,
}: {
  activeNav: DashboardNav;
  canClose?: boolean;
  onClose?: () => void;
  onNavigate: (destination: DashboardNav) => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appLogoSrc = `${import.meta.env.BASE_URL}app-logo.png`;
  const handleNavigate = (destination: DashboardNav) => {
    setMobileMenuOpen(false);
    onNavigate(destination);
  };

  return (
    <>
    <header className="appTopNavigation arcane-header" data-mobile-menu-open={mobileMenuOpen ? "true" : "false"}>
      <button
        className="appTopBrand arcane-logo"
        aria-label="Kembali ke Beranda"
        type="button"
        onClick={() => handleNavigate("home")}
      >
        <span className="appTopBrandLogo arcane-logo-mark" aria-hidden="true">
          <img src={appLogoSrc} alt="" />
        </span>
        <span className="arcane-logo-text">
          <strong className="arcane-logo-main">TOEFL Gratis</strong>
          <small className="arcane-logo-sub">Platform Yang Disusun Oleh Ibnu Hakim</small>
        </span>
      </button>

      <div className="appMobileControls" aria-label="Kontrol halaman">
        {canClose && !mobileMenuOpen ? (
          <button className="appMobileIconButton" type="button" aria-label="Tutup halaman" onClick={onClose}>
            <AppIcon name="close" />
          </button>
        ) : null}
        <button
          className="appMobileIconButton appMobileMenuButton"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <AppIcon name={mobileMenuOpen ? "close" : "menu"} />
        </button>
      </div>

      <nav className="appNavigation arcane-nav" aria-label="Navigasi utama">
        {NAVIGATION_ITEMS.map((item) => (
          <DashboardNavItem
            active={activeNav === item.id}
            item={item}
            key={item.id}
            onClick={() => handleNavigate(item.id)}
          />
        ))}
      </nav>

      <span className="appTopTrust arcane-badge arcane-badge-validated arcane-validated-badge">
        <AppIcon name="check" />
        Bank tervalidasi
      </span>
    </header>

    <nav className="appBottomNavigation" aria-label="Navigasi cepat">
      {NAVIGATION_ITEMS.map((item) => {
        const active = activeNav === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`appBottomNavItem${active ? " isActive" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            onClick={() => handleNavigate(item.id)}
          >
            <span className="appBottomNavIcon" aria-hidden="true">
              <AppIcon name={item.icon} />
            </span>
            <span className="appBottomNavLabel">{item.mobileLabel}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
}
