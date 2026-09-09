"use client";

import { Component, type ReactNode } from "react";
import { LoginHeroScene } from "./login-hero-scene";

// Second, independent safety layer around LoginHeroScene (which already
// try/catches its own WebGL setup and render loop internally). A class
// component is the only way React can catch a *render-phase* error from a
// child, so this exists purely as a belt-and-suspenders guard — if
// anything about the 3D scene ever throws during React's own render, this
// silently renders nothing instead of taking the whole /login page down.
// This is intentionally the ONLY thing standing between "decorative 3D
// glitch" and "nobody can sign in", so it stays deliberately tiny and
// dependency-free.
class LoginHero3DBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("LoginHero3D: decorative 3D scene failed, hiding it:", error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function LoginHero3D() {
  return (
    <LoginHero3DBoundary>
      <LoginHeroScene />
    </LoginHero3DBoundary>
  );
}
