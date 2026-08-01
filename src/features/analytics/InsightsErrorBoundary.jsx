import { Component } from 'react';

// ── Post-ship hardening, Slice 14 ────────────────────────────────────────
// This app had NO error boundary anywhere (grep-confirmed) — a bug in any
// single component could unmount the entire React tree, which is exactly
// what happened when LiveTab.jsx threw synchronously on mount (see its
// own header comment for the actual bug). Rather than a blanket app-wide
// boundary (a bigger, riskier change touching every page), this is scoped
// tightly to AdminPanel.jsx's Insights tab, the newest and least-proven
// part of the app — if a future bug slips into one of its six sub-tabs,
// the rest of the site (map, nav, search, everything a student depends
// on) stays completely unaffected; only the Insights tab shows a fallback.
export default class InsightsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Matches this codebase's existing pattern of a plain console.error on
    // caught failures (see ReviewModal.jsx) — no new logging service wired
    // up here, that's a separate decision for a future session.
    console.error('Insights tab crashed:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--muted)' }}>
          <div style={{ color: 'var(--error)', fontWeight: 700, marginBottom: 6 }}>
            Insights tab hit an error.
          </div>
          <div style={{ marginBottom: 10 }}>
            The rest of the app is unaffected. Reopen this tab to retry.
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, wordBreak: 'break-word' }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}