import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

/**
 * Catches render-time crashes anywhere in the tree so a single broken
 * component does not leave the user staring at a blank page. Shows a
 * friendly Indonesian fallback with a reload action.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : undefined,
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep a trace in the console for debugging / future error tracking.
    console.error("App crashed:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="appErrorBoundary" role="alert">
        <div className="appErrorBoundaryCard">
          <h1>Aduh, terjadi kesalahan tak terduga</h1>
          <p>
            Aplikasi mengalami gangguan saat menampilkan halaman ini. Progres belajarmu
            tersimpan otomatis, jadi kamu bisa memuat ulang dengan aman.
          </p>
          {this.state.message ? <p className="appErrorBoundaryDetail">{this.state.message}</p> : null}
          <button type="button" onClick={this.handleReload}>
            Muat ulang aplikasi
          </button>
        </div>
      </div>
    );
  }
}
