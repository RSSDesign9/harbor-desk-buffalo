import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Short name of the region, used in the recovery message. */
  region: string;
  children: ReactNode;
  /** Optional custom fallback; receives a reset callback. */
  fallback?: (reset: () => void, error: Error) => ReactNode;
  /** Called on “Try again”, e.g. to re-create a lazy import whose failed promise React has cached. */
  onReset?: () => void;
  /** Called once when the region fails (e.g. so the shell can switch the map to the 2D plan). */
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

/**
 * Isolates a failing region (scene, panel, fixture loader) so the rest of the app keeps working.
 * Copy follows DESIGN §13: what happened and the next action, under 12 words.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local console only; no external telemetry.
    console.error(`[${this.props.region}]`, error, info.componentStack);
    this.props.onError?.(error);
  }

  reset = (): void => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset, error);
    return (
      <div role="alert" className="region-error">
        <p className="label">{this.props.region} unavailable</p>
        <p>This area failed to load. Other areas still work.</p>
        <button type="button" className="btn btn-secondary" onClick={this.reset}>
          Try again
        </button>
      </div>
    );
  }
}
