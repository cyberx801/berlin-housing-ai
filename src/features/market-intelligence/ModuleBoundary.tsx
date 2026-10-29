"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";

interface ModuleBoundaryProps {
  /** A new value (e.g. new filters) clears a caught error. */
  resetKey: string;
  children: ReactNode;
}

interface ModuleBoundaryState {
  failed: boolean;
  key: string;
}

/** Keeps one module that fails to render from taking the others down with it. */
export class ModuleBoundary extends Component<ModuleBoundaryProps, ModuleBoundaryState> {
  override state: ModuleBoundaryState = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<ModuleBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: ModuleBoundaryProps, state: ModuleBoundaryState) {
    return props.resetKey === state.key ? null : { failed: false, key: props.resetKey };
  }

  override componentDidCatch(error: unknown) {
    console.error("Market module failed to render:", error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <StatusPanel
        tone="error"
        titleAs="h3"
        title="This chart couldn't be drawn"
        actions={
          <Button variant="secondary" size="sm" onClick={() => this.setState({ failed: false })}>
            Try again
          </Button>
        }
      >
        <p>The other charts on this page are not affected.</p>
      </StatusPanel>
    );
  }
}
