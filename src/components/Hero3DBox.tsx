import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * A small, self-contained Three.js scene: a rotating "shipment package" —
 * a soft rounded box (matching the clay design system's terracotta accent)
 * orbited by a mint ring and a small sparkle, with a gentle mouse-parallax
 * tilt. Pure decorative flourish for the Landing hero — no dependency on
 * @react-three/fiber, just vanilla three.js scoped to one canvas.
 */
export function Hero3DBox() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.4, 5.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lights — warm key light + soft cool fill, matching the clay palette's
    // warm-cream ground with a terracotta accent.
    const ambient = new THREE.AmbientLight(0xfbe8d3, 0.9);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffd9ad, 1.6);
    key.position.set(3, 4, 4);
    scene.add(key);
    const fill = new THREE.PointLight(0x8fcfa8, 0.9, 12);
    fill.position.set(-3, -1.5, 2.5);
    scene.add(fill);

    // The package: a rounded terracotta box with a lighter "shipping label"
    // plane on its front face.
    const group = new THREE.Group();

    const boxGeo = new RoundedBoxGeometry(1.7, 1.7, 1.7, 4, 0.22);
    const boxMat = new THREE.MeshPhysicalMaterial({
      color: 0xd97a4a,
      roughness: 0.55,
      metalness: 0.05,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    group.add(box);

    const labelGeo = new THREE.PlaneGeometry(0.95, 0.62);
    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xfbf3e7,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 0.05, 0.865);
    group.add(label);

    // Two "tape" strips crossing the box top, echoing a real parcel.
    const tapeMat = new THREE.MeshStandardMaterial({
      color: 0xf3d9b8,
      roughness: 0.7,
    });
    const tapeGeo = new THREE.BoxGeometry(1.78, 0.02, 0.28);
    const tapeTop = new THREE.Mesh(tapeGeo, tapeMat);
    tapeTop.position.set(0, 0.851, 0);
    group.add(tapeTop);

    // Orbiting mint ring (torus) — a soft halo, tilted for a 3/4 view.
    const ringGeo = new THREE.TorusGeometry(1.55, 0.035, 16, 96);
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

    // Small orbiting sparkle (icosahedron) riding the ring.
    const sparkleGeo = new THREE.IcosahedronGeometry(0.14, 0);
    const sparkleMat = new THREE.MeshStandardMaterial({
      color: 0xf0c257,
      roughness: 0.3,
      metalness: 0.3,
      emissive: 0x8a5f16,
      emissiveIntensity: 0.25,
    });
    const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
    group.add(sparkle);

    group.rotation.set(0.35, -0.5, 0);
    scene.add(group);

    // Mouse-parallax target (subtle tilt only, never full rotation control).
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
    const clock = new THREE.Clock();

    const renderFrame = () => {
      const delta = clock.getDelta();
      if (!prefersReducedMotion) {
        angle += delta * 0.35;
        group.rotation.y = -0.5 + angle;
        group.rotation.x = 0.35 + Math.sin(angle * 0.6) * 0.06;
        sparkle.position.set(
          Math.cos(angle * 1.4) * 1.55,
          Math.sin(angle * 1.4) * 1.55 * Math.sin(Math.PI / 2.6),
          Math.sin(angle * 1.4) * 1.55 * Math.cos(Math.PI / 2.6),
        );
      }
      // Gentle camera parallax toward the cursor, always applied (even with
      // reduced motion the tilt itself is a one-time settle, not a loop).
      camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.04;
      camera.position.y += (0.4 - pointer.y * 0.3 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderFrame);
    };
    frameId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      container.removeChild(renderer.domElement);
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
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="size-full"
      aria-hidden="true"
      role="presentation"
    />
  );
}
