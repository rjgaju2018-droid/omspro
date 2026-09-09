"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// OMS Pro landing hero (2026-09-09) — a bigger evolution of the rotating
// parcel scene from /login (login-hero-scene.tsx): same warm studio lights,
// same terracotta-and-cream palette that bridges into the dashboard's Clay
// theme, plus a tilted mint orbit ring, three drifting satellite cubes and a
// slowly parallaxing camera. Decorative only — wrapped in the same two
// independent failure layers as login (try/catch around WebGL setup + the
// render loop, and a React error boundary in the parent component), so a
// 3D glitch can never break the marketing page itself.
export function LandingHeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0.4, 5.4);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight(0xfbe8d3, 0.9);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffd9ad, 1.6);
      key.position.set(3, 4, 4);
      scene.add(key);
      const fill = new THREE.PointLight(0x8fcfa8, 0.9, 12);
      fill.position.set(-3, -1.5, 2.5);
      scene.add(fill);

      const group = new THREE.Group();

      // The hero parcel — same asset as the login hero, scaled up a touch.
      const boxGeo = new RoundedBoxGeometry(1.8, 1.8, 1.8, 4, 0.24);
      const boxMat = new THREE.MeshPhysicalMaterial({
        color: 0xd97a4a,
        roughness: 0.55,
        metalness: 0.05,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      group.add(box);

      const labelGeo = new THREE.PlaneGeometry(1.0, 0.66);
      const labelMat = new THREE.MeshStandardMaterial({ color: 0xfbf3e7, roughness: 0.85, side: THREE.DoubleSide });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.set(0, 0.05, 0.915);
      group.add(label);

      const tapeMat = new THREE.MeshStandardMaterial({ color: 0xf3d9b8, roughness: 0.7 });
      const tapeGeo = new THREE.BoxGeometry(1.88, 0.02, 0.3);
      const tape = new THREE.Mesh(tapeGeo, tapeMat);
      tape.position.set(0, 0.901, 0);
      group.add(tape);

      // Tilted mint orbit ring + a gold sparkle riding it.
      const ringGeo = new THREE.TorusGeometry(1.65, 0.04, 16, 96);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x8fcfa8,
        roughness: 0.4,
        metalness: 0.15,
        emissive: 0x2c5f43,
        emissiveIntensity: 0.15,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.6;
      ring.rotation.y = 0.3;
      group.add(ring);

      const sparkleGeo = new THREE.IcosahedronGeometry(0.15, 0);
      const sparkleMat = new THREE.MeshStandardMaterial({
        color: 0xf0c257,
        roughness: 0.3,
        metalness: 0.3,
        emissive: 0x8a5f16,
        emissiveIntensity: 0.25,
      });
      const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
      group.add(sparkle);

      // Three small satellite cubes drifting on their own orbits.
      const satellites: { mesh: THREE.Mesh; radius: number; speed: number; tilt: number; phase: number }[] = [];
      const satGeo = new RoundedBoxGeometry(0.22, 0.22, 0.22, 2, 0.05);
      const satColors = [0x8fcfa8, 0xf0c257, 0xe9c8b4];
      satColors.forEach((color, i) => {
        const satMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
        const mesh = new THREE.Mesh(satGeo, satMat);
        group.add(mesh);
        satellites.push({ mesh, radius: 2.15 + i * 0.28, speed: 0.5 + i * 0.17, tilt: 0.9 + i * 0.4, phase: i * 2.1 });
      });

      group.rotation.set(0.35, -0.5, 0);
      scene.add(group);

      const pointer = { x: 0, y: 0 };
      const handlePointerMove = (event: PointerEvent) => {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", handlePointerMove);

      const resize = () => {
        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight, false);
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      let frameId = 0;
      let angle = 0;
      let disposed = false;
      const clock = new THREE.Clock();

      const renderFrame = () => {
        if (disposed) return;
        try {
          const delta = clock.getDelta();
          if (!prefersReducedMotion) {
            angle += delta * 0.35;
            group.rotation.y = -0.5 + angle;
            group.rotation.x = 0.35 + Math.sin(angle * 0.6) * 0.06;
            sparkle.position.set(
              Math.cos(angle * 1.4) * 1.65,
              Math.sin(angle * 1.4) * 1.65 * Math.sin(Math.PI / 2.6),
              Math.sin(angle * 1.4) * 1.65 * Math.cos(Math.PI / 2.6)
            );
            for (const sat of satellites) {
              const a = angle * sat.speed + sat.phase;
              sat.mesh.position.set(
                Math.cos(a) * sat.radius,
                Math.sin(a * 1.2 + sat.phase) * 0.35 * Math.sin(sat.tilt),
                Math.sin(a) * sat.radius * 0.6
              );
              sat.mesh.rotation.x = a;
              sat.mesh.rotation.y = a * 0.7;
            }
          }
          camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.04;
          camera.position.y += (0.4 - pointer.y * 0.3 - camera.position.y) * 0.04;
          camera.lookAt(0, 0, 0);

          renderer.render(scene, camera);
          frameId = requestAnimationFrame(renderFrame);
        } catch (err) {
          console.error("LandingHeroScene: render loop stopped:", err);
          disposed = true;
        }
      };
      frameId = requestAnimationFrame(renderFrame);

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        window.removeEventListener("pointermove", handlePointerMove);
        try {
          container.removeChild(renderer.domElement);
        } catch {
          // already detached — fine
        }
        boxGeo.dispose();
        boxMat.dispose();
        labelGeo.dispose();
        labelMat.dispose();
        tapeGeo.dispose();
        tapeMat.dispose();
        ringGeo.dispose();
        ringMat.dispose();
        sparkleGeo.dispose();
        sparkleMat.dispose();
        satGeo.dispose();
        satellites.forEach((s) => s.mesh.material instanceof THREE.Material && s.mesh.material.dispose());
        renderer.dispose();
      };
    } catch (err) {
      console.error("LandingHeroScene: could not initialize, skipping decorative 3D:", err);
      return undefined;
    }
  }, []);

  return <div ref={containerRef} className="size-full" aria-hidden="true" role="presentation" />;
}
