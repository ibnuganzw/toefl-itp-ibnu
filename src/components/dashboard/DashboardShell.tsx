import type { DashboardShellProps } from "../../types/dashboardTypes";
import { Surface } from "../ui/Surface";
import { DashboardTopNavigation } from "./DashboardTopNavigation";

export function DashboardShell({
  activeNav,
  activeScreen,
  canClose = false,
  children,
  stats,
  subtitle,
  title,
  hideNavigation = false,
  onClose,
  onNavigate,
}: DashboardShellProps) {
  return (
    <div className="dashboardViewport arcane-app-shell" data-screen={activeScreen}>
      <div className="dashboardFrame" data-navigation-hidden={hideNavigation ? "true" : "false"}>
        {!hideNavigation ? (
          <DashboardTopNavigation
            activeNav={activeNav}
            canClose={canClose}
            onClose={onClose}
            onNavigate={onNavigate}
          />
        ) : null}

        <section className="dashboardMain" id="main-content" tabIndex={-1}>
          {activeScreen === "session" || activeScreen === "result" || activeScreen === "review" ? (
            <header className={`dashboardTopbar ${activeScreen === "session" ? "arcane-exam-topbar" : ""}`}>
              <div className="dashboardTitle">
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              {stats.length ? (
                <div className="dashboardTopStats" aria-label="Statistik ringkas">
                  {stats.map((stat) => (
                    <Surface className="dashboardTopStat" key={stat.label}>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </Surface>
                  ))}
                </div>
              ) : null}
            </header>
          ) : null}
          <div className="dashboardContent">{children}</div>
        </section>
      </div>
    </div>
  );
}
