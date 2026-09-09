"use client";

import { Component, type ReactNode } from "react";
import { LandingHeroScene } from "./landing-hero-scene";

// Same belt-and-suspenders pattern as LoginHero3D (see that file's comment):
// a class component is the only way React can catch a *render-phase* error
// from a child, so this tiny boundary is the second of the two independent
// safety layers around the decorative 3D — a failure here renders nothing
// instead of taking the landing page down.
class LandingHero3DBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("LandingHero3D: decorative 3D scene failed, hiding it:", error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function LandingHero3D() {
  return (
    <LandingHero3DBoundary>
      <LandingHeroScene />
    </LandingHero3DBoundary>
  );
}
