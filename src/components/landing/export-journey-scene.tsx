"use client";

// 2026-09-15 — the "refurnish" round's signature piece: a scroll-driven 3D
// export journey for the landing page. As the visitor scrolls, a parcel is
// packed → loaded on a truck → driven to the airport → a cargo plane lifts
// off → cruises across a starfield sky → destination flags slide past
// (USA, Canada, Mexico, UK, France) → the plane descends and a delivery
// truck completes the last mile ("pack parcel = truck road = airport =
// flight = sky = usa canada mexico uk france 3d animation = truck for
// delivery").
//
// Implementation: one fixed full-viewport canvas driven by the scroll
// progress through its tall host section (same technique as the existing
// landing-hero-scene.tsx's plain three.js usage, no react-three-fiber —
// keeps the bundle identical to what the app already ships). Scroll progress
// p ∈ [0,1] maps to journey chapters; each chapter positions/animates the
// shared props (parcel, truck, plane) with smooth lerps so chapter
// transitions glide instead of snap. Decorative only: two independent
// failure layers (try/catch around setup + render loop, and an error
// boundary in the parent) mean a WebGL glitch can never break the page.
import { useEffect, useRef } from "react";
import * as THREE from "three";

// Journey chapters — scroll progress ranges. Kept in one table so the
// caption overlay (landing-page.tsx) can show the right label at the right
// time without duplicating the math.
export const JOURNEY_CHAPTERS: { until: number; label: string }[] = [
  { until: 0.14, label: "Parcel packed & sealed" },
  { until: 0.3, label: "Truck hits the highway" },
  { until: 0.44, label: "Arrival at the air cargo hub" },
  { until: 0.6, label: "Wheels up — international departure" },
  { until: 0.8, label: "Cruising across continents" },
  { until: 1, label: "Last-mile delivery at the doorstep" },
];

export function journeyLabelFor(progress: number): string {
  for (const c of JOURNEY_CHAPTERS) if (progress <= c.until) return c.label;
  return JOURNEY_CHAPTERS[JOURNEY_CHAPTERS.length - 1].label;
}

// Palette — the app's terracotta-and-cream landing theme + a night-sky blue
// for the flight chapter (all text on the page stays light-on-dark).
const TERRACOTTA = 0xd97a4a;
const CREAM = 0xfbf3e7;
const GOLD = 0xf0c257;
const NIGHT = 0x0b1026;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
// Smooth 0→1 ramp within [from,to] with ease-in-out.
function seg(p: number, from: number, to: number) {
  const t = Math.min(1, Math.max(0, (p - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export function ExportJourneyScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const wrap = canvasWrapRef.current;
    const caption = captionRef.current;
    if (!host || !wrap) return;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let disposed = false;
    let frameId = 0;
    const cleanups: (() => void)[] = [];

    try {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(NIGHT);
      scene.fog = new THREE.Fog(NIGHT, 14, 46);

      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      wrap.appendChild(renderer.domElement);
      cleanups.push(() => {
        try {
          wrap.removeChild(renderer.domElement);
        } catch {
          /* detached already */
        }
        renderer.dispose();
      });

      // ---------- lights ----------
      scene.add(new THREE.AmbientLight(0xdfe8ff, 0.55));
      const key = new THREE.DirectionalLight(0xffe2bd, 1.5);
      key.position.set(4, 6, 3);
      scene.add(key);
      const rim = new THREE.PointLight(0x6ea8ff, 0.8, 30);
      rim.position.set(-6, 3, -4);
      scene.add(rim);

      // ---------- ground: a dark reflective road plane ----------
      const groundGeo = new THREE.PlaneGeometry(90, 90);
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x10162e, roughness: 0.9, metalness: 0.1 });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      cleanups.push(() => {
        groundGeo.dispose();
        groundMat.dispose();
      });

      // Road strip (dark asphalt with edge lines) running along X.
      const roadGeo = new THREE.PlaneGeometry(60, 2.6);
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a2138, roughness: 0.75 });
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.y = 0.01;
      scene.add(road);
      cleanups.push(() => {
        roadGeo.dispose();
        roadMat.dispose();
      });
      for (const z of [-1.35, 1.35]) {
        const lineGeo = new THREE.PlaneGeometry(60, 0.08);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x3d4a6b });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, z);
        scene.add(line);
        cleanups.push(() => {
          lineGeo.dispose();
          lineMat.dispose();
        });
      }

      // Dashed centerline that scrolls with the truck chapter.
      const dashGroup = new THREE.Group();
      const dashGeo = new THREE.PlaneGeometry(1.2, 0.1);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0x55648c });
      for (let i = 0; i < 24; i++) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(-30 + i * 2.6, 0.02, 0);
        dashGroup.add(dash);
      }
      scene.add(dashGroup);
      cleanups.push(() => {
        dashGeo.dispose();
        dashMat.dispose();
      });

      // ---------- the parcel (hero prop across all chapters) ----------
      const parcelGroup = new THREE.Group();
      const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      const boxMat = new THREE.MeshPhysicalMaterial({ color: TERRACOTTA, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 });
      const parcel = new THREE.Mesh(boxGeo, boxMat);
      parcelGroup.add(parcel);
      const tapeGeo = new THREE.BoxGeometry(0.94, 0.05, 0.3);
      const tapeMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.7 });
      const tape1 = new THREE.Mesh(tapeGeo, tapeMat);
      tape1.position.y = 0.46;
      parcelGroup.add(tape1);
      const tape2 = tape1.clone();
      tape2.rotation.y = Math.PI / 2;
      parcelGroup.add(tape2);
      const labelGeo = new THREE.PlaneGeometry(0.5, 0.34);
      const labelMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.85 });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.set(0, 0.02, 0.462);
      parcelGroup.add(label);
      scene.add(parcelGroup);
      cleanups.push(() => {
        boxGeo.dispose();
        boxMat.dispose();
        tapeGeo.dispose();
        tapeMat.dispose();
        labelGeo.dispose();
        labelMat.dispose();
      });

      // ---------- delivery truck (chapters 2 & 6) ----------
      const truckGroup = new THREE.Group();
      const cabGeo = new THREE.BoxGeometry(1.1, 1.0, 1.4);
      const cabMat = new THREE.MeshStandardMaterial({ color: 0x24435e, roughness: 0.4, metalness: 0.35 });
      const cab = new THREE.Mesh(cabGeo, cabMat);
      cab.position.set(1.15, 0.85, 0);
      truckGroup.add(cab);
      const cargoGeo = new THREE.BoxGeometry(2.4, 1.5, 1.6);
      const cargoMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.6 });
      const cargo = new THREE.Mesh(cargoGeo, cargoMat);
      cargo.position.set(-0.7, 1.1, 0);
      truckGroup.add(cargo);
      const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 18);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0f18, roughness: 0.9 });
      const wheels: THREE.Mesh[] = [];
      for (const [x, z] of [
        [1.15, 0.72],
        [1.15, -0.72],
        [-0.2, 0.72],
        [-0.2, -0.72],
        [-1.3, 0.72],
        [-1.3, -0.72],
      ]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.32, z);
        truckGroup.add(w);
        wheels.push(w);
      }
      truckGroup.visible = false;
      scene.add(truckGroup);
      cleanups.push(() => {
        cabGeo.dispose();
        cabMat.dispose();
        cargoGeo.dispose();
        cargoMat.dispose();
        wheelGeo.dispose();
        wheelMat.dispose();
      });

      // ---------- airport (chapter 3): tower + hangar + runway lights ----------
      const airportGroup = new THREE.Group();
      const towerGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.6, 12);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.6 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(-6, 1.3, -6);
      airportGroup.add(tower);
      const topGeo = new THREE.SphereGeometry(0.62, 18, 12);
      const topMat = new THREE.MeshPhysicalMaterial({ color: 0x8fd0ff, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 });
      const towerTop = new THREE.Mesh(topGeo, topMat);
      towerTop.position.set(-6, 2.9, -6);
      airportGroup.add(towerTop);
      const hangarGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.4, 18, 1, false, 0, Math.PI);
      const hangarMat = new THREE.MeshStandardMaterial({ color: 0x1d2440, roughness: 0.7 });
      const hangar = new THREE.Mesh(hangarGeo, hangarMat);
      hangar.rotation.z = Math.PI / 2;
      hangar.rotation.y = Math.PI / 2;
      hangar.position.set(-10, 0.01, -7);
      hangar.scale.y = 0.9;
      airportGroup.add(hangar);
      // Runway edge lights (small emissive dots along Z beyond the road).
      const lightGeo = new THREE.SphereGeometry(0.07, 8, 8);
      const lightMatOn = new THREE.MeshBasicMaterial({ color: GOLD });
      for (let i = 0; i < 14; i++) {
        const l = new THREE.Mesh(lightGeo, lightMatOn);
        l.position.set(-14 + i * 1.6, 0.1, -3.4);
        airportGroup.add(l);
      }
      airportGroup.visible = false;
      scene.add(airportGroup);
      cleanups.push(() => {
        towerGeo.dispose();
        towerMat.dispose();
        topGeo.dispose();
        topMat.dispose();
        hangarGeo.dispose();
        hangarMat.dispose();
        lightGeo.dispose();
        lightMatOn.dispose();
      });

      // ---------- cargo plane (chapters 4-5) ----------
      const planeGroup = new THREE.Group();
      const fuselageGeo = new THREE.CapsuleGeometry(0.42, 3.2, 6, 14);
      const fuselageMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.35, metalness: 0.25 });
      const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
      fuselage.rotation.z = Math.PI / 2;
      planeGroup.add(fuselage);
      const wingGeo = new THREE.BoxGeometry(1.1, 0.09, 4.4);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 0.4, metalness: 0.2 });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(0.2, 0.1, 0);
      planeGroup.add(wing);
      const tailFinGeo = new THREE.BoxGeometry(0.7, 1.0, 0.09);
      const tail = new THREE.Mesh(tailFinGeo, wingMat);
      tail.position.set(1.9, 0.5, 0);
      planeGroup.add(tail);
      const tailWingGeo = new THREE.BoxGeometry(0.4, 0.07, 1.6);
      const tailWing = new THREE.Mesh(tailWingGeo, wingMat);
      tailWing.position.set(1.9, 0.12, 0);
      planeGroup.add(tailWing);
      // Engines under the wings.
      const engGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10);
      const engMat = new THREE.MeshStandardMaterial({ color: 0x33405e, roughness: 0.4, metalness: 0.5 });
      for (const z of [-1.2, 1.2]) {
        const e = new THREE.Mesh(engGeo, engMat);
        e.rotation.x = Math.PI / 2;
        e.position.set(0.1, -0.06, z);
        planeGroup.add(e);
      }
      // Big OMS Pro parcel riding inside — sits atop the fuselage.
      const cargoBox = new THREE.Mesh(boxGeo, boxMat);
      cargoBox.scale.setScalar(0.8);
      cargoBox.position.set(-0.4, 0.65, 0);
      planeGroup.add(cargoBox);
      planeGroup.visible = false;
      scene.add(planeGroup);
      cleanups.push(() => {
        fuselageGeo.dispose();
        fuselageMat.dispose();
        wingGeo.dispose();
        wingMat.dispose();
        tailFinGeo.dispose();
        tailWingGeo.dispose();
        engGeo.dispose();
        engMat.dispose();
      });

      // ---------- starfield (chapter 5 sky) ----------
      const starGeo = new THREE.BufferGeometry();
      const starCount = 420;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 80;
        starPos[i * 3 + 1] = 4 + Math.random() * 30;
        starPos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.09, transparent: true, opacity: 0 });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);
      cleanups.push(() => {
        starGeo.dispose();
        starMat.dispose();
      });

      // ---------- destination flags (chapter 5) ----------
      // Stylized flag panels with approximate flag colors (no textures —
      // simple two-tone bars keep this dependency-free).
      const FLAGS: { name: string; colors: [number, number, number] }[] = [
        { name: "USA", colors: [0x3c3b6e, 0xffffff, 0xb22234] },
        { name: "Canada", colors: [0xd80621, 0xffffff, 0xd80621] },
        { name: "Mexico", colors: [0x006847, 0xffffff, 0xce1126] },
        { name: "UK", colors: [0x012169, 0xffffff, 0xc8102e] },
        { name: "France", colors: [0x002395, 0xffffff, 0xed2939] },
      ];
      const flagMeshes: { group: THREE.Group; x: number }[] = [];
      const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x8891a8, roughness: 0.5, metalness: 0.4 });
      const barGeo = new THREE.BoxGeometry(0.06, 0.8, 1.4);
      FLAGS.forEach((f, i) => {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.3;
        g.add(pole);
        f.colors.forEach((c, ci) => {
          const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide });
          const bar = new THREE.Mesh(barGeo, m);
          bar.position.set(0.03, 2.2 - ci * 0.27, 0);
          bar.scale.z = 0.32;
          g.add(bar);
          cleanups.push(() => m.dispose());
        });
        g.position.set(-26 + i * 5.4, 0, -6.5);
        g.visible = false;
        scene.add(g);
        flagMeshes.push({ group: g, x: g.position.x });
        cleanups.push(() => {
          g.clear();
        });
      });
      cleanups.push(() => {
        poleGeo.dispose();
        poleMat.dispose();
        barGeo.dispose();
      });

      // City skyline silhouettes for the final delivery chapter.
      const cityGroup = new THREE.Group();
      const bldgMat = new THREE.MeshStandardMaterial({ color: 0x141b33, roughness: 0.85 });
      const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
      for (let i = 0; i < 16; i++) {
        const h = 1 + Math.random() * 4;
        const b = new THREE.Mesh(bldgGeo, bldgMat);
        b.scale.set(1.4, h, 1.4);
        b.position.set(-20 + i * 2.7, h / 2, -11 - Math.random() * 4);
        cityGroup.add(b);
      }
      cityGroup.visible = false;
      scene.add(cityGroup);
      cleanups.push(() => {
        bldgGeo.dispose();
        bldgMat.dispose();
      });

      // ---------- sizing / scroll ----------
      const resize = () => {
        const { clientWidth: w, clientHeight: h } = wrap;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(wrap);
      cleanups.push(() => ro.disconnect());

      let progress = 0;
      let target = 0;
      const onScroll = () => {
        const rect = host.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));

      // ---------- render loop ----------
      const clock = new THREE.Clock();
      let captionLabel = "";
      const renderFrame = () => {
        if (disposed) return;
        try {
          const dt = Math.min(clock.getDelta(), 0.05);
          // Smooth the scroll follow so chapter transitions glide.
          progress = lerp(progress, target, prefersReducedMotion ? 1 : 0.08);
          const p = progress;

          // Chapter visibility.
          const packPhase = seg(p, 0, 0.14);
          const truckPhase = seg(p, 0.14, 0.3);
          const airportPhase = seg(p, 0.3, 0.44);
          const cruisePhase = seg(p, 0.6, 0.8);
          const deliveryPhase = seg(p, 0.8, 1);

          truckGroup.visible = p > 0.1 && p < 0.52;
          airportGroup.visible = p > 0.24 && p < 0.62;
          planeGroup.visible = p > 0.4;
          cityGroup.visible = p > 0.74;

          // Flags fade/slide in during cruise, out during delivery.
          const flagAlpha = Math.min(cruisePhase, 1 - deliveryPhase * 0.4);
          flagMeshes.forEach((f, i) => {
            f.group.visible = flagAlpha > 0.02;
            const slide = (1 - flagAlpha) * -6;
            f.group.position.x = f.x + slide + i * 0.4;
            f.group.position.y = (1 - flagAlpha) * -0.6;
            f.group.rotation.y = Math.sin(p * 20 + i) * 0.06;
          });
          starMat.opacity = Math.max(cruisePhase * 0.9, deliveryPhase * 0.25);
          stars.visible = starMat.opacity > 0.02;

          // Sky brightens toward dawn during delivery.
          const dawn = new THREE.Color(NIGHT).lerp(new THREE.Color(0x18224a), deliveryPhase);
          (scene.background as THREE.Color).copy(dawn);
          scene.fog?.color.copy(dawn);

          // ---- parcel motion ----
          if (p < 0.14) {
            // Packing: spins gently in place on the road, camera close.
            parcelGroup.visible = true;
            const s = 0.4 + packPhase * 0.6;
            parcelGroup.scale.setScalar(s);
            parcelGroup.position.set(0, 0.45 * s + (1 - packPhase) * 0.15, 0);
            parcelGroup.rotation.y = packPhase * Math.PI * 1.5;
          } else if (p < 0.52) {
            // On the truck: parcel sits in the cargo box, truck drives.
            parcelGroup.visible = truckPhase < 0.98;
            const driveX = -14 + truckPhase * 22;
            truckGroup.position.set(driveX, 0, 0);
            truckGroup.rotation.y = 0;
            wheels.forEach((w) => (w.rotation.z -= dt * 6));
            // Camera follows alongside the truck.
            parcelGroup.position.set(driveX - 0.7, 1.85, 0);
            parcelGroup.rotation.set(0, 0, 0);
            parcelGroup.scale.setScalar(0.75);
          } else if (p < 0.6) {
            // At the airport: parcel slides toward the plane.
            const t = airportPhase;
            parcelGroup.visible = true;
            parcelGroup.position.set(lerp(8, -0.4, t), lerp(1.85, 0.65, t) + (1 - t) * 0.2, lerp(0, 0.4, t));
            parcelGroup.rotation.set(0, t * Math.PI, 0);
            parcelGroup.scale.setScalar(0.7);
            truckGroup.position.set(10 - t * 4, 0, -2 - t * 2);
          } else {
            // In the plane (visible cruising + descending with it).
            parcelGroup.visible = p < 0.97;
            parcelGroup.scale.setScalar(0.55);
            // Plane flight path: rises through takeoff, cruises, descends in delivery.
            const rise = seg(p, 0.44, 0.6);
            const cruiseZ = Math.sin(p * 12) * 0.8;
            const descend = seg(p, 0.8, 0.97);
            const planeY = lerp(0.9, 7.5, rise) - descend * 6.4;
            const planeX = -18 + p * 34;
            planeGroup.position.set(planeX, planeY, cruiseZ);
            planeGroup.rotation.z = lerp(-0.28 * (1 - rise), 0.3 * descend, 1) * -1;
            planeGroup.rotation.y = 0;
            planeGroup.rotation.x = Math.sin(p * 9) * 0.03;
            // Wheels/turbines idle spin.
            parcelGroup.position.set(planeX - 0.4, planeY + 0.65, cruiseZ);
            parcelGroup.rotation.y += dt * 0.6;
            if (p > 0.955) parcelGroup.visible = false;
          }

          // Delivery chapter: final truck approaches the city with the parcel.
          if (p >= 0.74) {
            const t = deliveryPhase;
            const driveX = -16 + t * 26;
            truckGroup.visible = true;
            truckGroup.position.set(driveX, 0, 3.2);
            truckGroup.rotation.y = 0.12;
            wheels.forEach((w) => (w.rotation.z -= dt * 7));
            if (p >= 0.97) {
              // Parcel pops out at the doorstep.
              parcelGroup.visible = true;
              parcelGroup.position.set(10.2, 0.45, 3.2);
              parcelGroup.rotation.set(0, 0, 0);
              parcelGroup.scale.setScalar(0.6);
            }
          }

          // ---- camera choreography ----
          const camTargets: [number, number, number, number, number, number][] = [
            // [x,y,z, lookX,lookY,lookZ]
            [3.2, 1.6, 4.2, 0, 0.6, 0], // pack — close-up
            [4.5, 2.4, 6.5, 0, 1, 0], // truck — side follow
            [2.5, 2.2, 7.5, -2, 1.2, -2], // airport wide
            [5.5, 2.6, 8.5, 0, 2.2, 0], // takeoff
            [0, 4.2, 12.5, 0, 3.2, 0], // cruise — wide sky
            [4.2, 2.0, 8.2, 4, 0.8, 2], // delivery street
          ];
          const c =
            camTargets[
              p < 0.14 ? 0 : p < 0.3 ? 1 : p < 0.44 ? 2 : p < 0.6 ? 3 : p < 0.8 ? 4 : 5
            ];
          camera.position.set(c[0], c[1], c[2]);
          camera.lookAt(c[3], c[4], c[5]);

          // Dash scroll for motion feel during truck chapter.
          dashGroup.position.x = -((p * 40) % 2.6);

          renderer.render(scene, camera);

          // Caption sync (DOM, cheap).
          if (caption) {
            const label = journeyLabelFor(p);
            if (label !== captionLabel) {
              captionLabel = label;
              caption.textContent = label;
            }
            caption.style.opacity = String(Math.min(1, Math.max(0, (p - 0.02) * 8, (1 - p) * 6)));
          }

          frameId = requestAnimationFrame(renderFrame);
        } catch (err) {
          console.error("ExportJourneyScene: render loop stopped:", err);
          disposed = true;
        }
      };
      frameId = requestAnimationFrame(renderFrame);
      cleanups.push(() => cancelAnimationFrame(frameId));
    } catch (err) {
      console.error("ExportJourneyScene: could not initialize, skipping decorative 3D:", err);
      return undefined;
    }

    return () => {
      disposed = true;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          /* already cleaned */
        }
      });
    };
  }, []);

  return (
    <div ref={hostRef} className="relative h-[420vh]">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div ref={canvasWrapRef} className="absolute inset-0" aria-hidden="true" />
        <div
          ref={captionRef}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/70 px-5 py-2 text-sm font-semibold text-slate-100 backdrop-blur-md"
          style={{ opacity: 0 }}
        />
      </div>
    </div>
  );
}
