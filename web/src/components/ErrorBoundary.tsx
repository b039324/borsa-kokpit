import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  // Bu değer değişince hata durumu sıfırlanır (örn. başka hisse seçilince yeniden dener).
  resetKey?: unknown;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="module-error">
        <p>Bu modül hata verdi.</p>
        <button type="button" onClick={() => this.setState({ failed: false })}>
          Tekrar dene
        </button>
      </div>
    );
  }
}
