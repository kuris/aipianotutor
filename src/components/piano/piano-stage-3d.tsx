import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  isBlackKey,
  isWhiteKey,
  type KeyRange,
} from "@/lib/piano/geometry";
import type { LessonFrame } from "@/lib/piano/types";

interface PianoStage3DProps {
  frame: LessonFrame;
  range: KeyRange;
}

export function PianoStage3D({ frame, range }: PianoStage3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    mixer?: THREE.AnimationMixer;
    action?: THREE.AnimationAction;
    keyGlowGroup: THREE.Group;
    keyGlows: Map<number, THREE.Mesh>;
    cameraTargetPos?: THREE.Vector3;
    controlsTargetPos?: THREE.Vector3;
  } | null>(null);

  const [viewAngle, setViewAngle] = useState<"custom" | "cinematic" | "side" | "player" | "top">("cinematic");

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        if (!containerRef.current || !stateRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        stateRef.current.camera.aspect = w / h;
        stateRef.current.camera.updateProjectionMatrix();
        stateRef.current.renderer.setSize(w, h);
      }, 50);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await rootRef.current.requestFullscreen();
      } catch (e) {
        console.error("Fullscreen error:", e);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (e) {
        console.error("Exit fullscreen error:", e);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 480;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0e14); // Atmospheric concert dark background
    scene.fog = new THREE.FogExp2(0x0c0e14, 0.0006);

    // Camera: Grand Concert Cinema 3/4 Perspective View
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 3500);
    camera.position.set(-180, 160, 240);
    camera.lookAt(10, 85, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 2. Concert Lighting
    const ambientLight = new THREE.AmbientLight(0xffeedd, 2.0);
    scene.add(ambientLight);

    const mainSpot = new THREE.SpotLight(0xfffaee, 4.5, 2600, Math.PI / 3.2, 0.45, 1.2);
    mainSpot.position.set(-160, 520, 320);
    mainSpot.target.position.set(0, 80, 0);
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.width = 2048;
    mainSpot.shadow.mapSize.height = 2048;
    mainSpot.shadow.bias = -0.0002;
    scene.add(mainSpot);
    scene.add(mainSpot.target);

    const rimLight = new THREE.DirectionalLight(0x7da8ea, 1.8);
    rimLight.position.set(280, 280, -220);
    scene.add(rimLight);

    const fillWarm = new THREE.PointLight(0xffc266, 2.2, 800);
    fillWarm.position.set(120, 140, 160);
    scene.add(fillWarm);

    // 3. Stage Floor
    const floorGeo = new THREE.PlaneGeometry(4000, 4000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x161311,
      roughness: 0.35,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Load Complete Animated Pianist & Grand Piano Model
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      "/models/animated_pianist.glb",
      (gltf) => {
        const model = gltf.scene;

        // Auto-scale and center the full model
        const bbox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 175 / (maxDim || 1);

        model.scale.set(scale, scale, scale);
        // Center on floor
        model.position.set(-center.x * scale, -bbox.min.y * scale, -center.z * scale);

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat && mat.color) {
              mat.roughness = Math.min(mat.roughness ?? 0.5, 0.4);
            }
          }
        });

        modelGroup.add(model);

        // Setup Playing Animation Mixer
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]!);
          action.play();
          if (stateRef.current) {
            stateRef.current.mixer = mixer;
            stateRef.current.action = action;
          }
        }
      },
      undefined,
      (err) => {
        console.warn("Pianist GLB model load error:", err);
      },
    );

    // 5. Interactive Key Glow Group (Matches real-time song note hits)
    const keyGlowGroup = new THREE.Group();
    keyGlowGroup.position.set(0, 76, 55);
    scene.add(keyGlowGroup);

    const keyGlows = new Map<number, THREE.Mesh>();
    const whiteGlowGeo = new THREE.BoxGeometry(1.8, 1.2, 16);
    const blackGlowGeo = new THREE.BoxGeometry(1.4, 1.4, 11);

    for (let p = 21; p <= 108; p++) {
      const black = isBlackKey(p);
      let whiteIdx = 0;
      for (let i = 21; i < p; i++) if (isWhiteKey(i)) whiteIdx++;

      const kx = (whiteIdx - 26) * 2.15 + (black ? 1.05 : 0);
      const kz = black ? -3.5 : 0;

      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      });
      const glowMesh = new THREE.Mesh(black ? blackGlowGeo : whiteGlowGeo, mat);
      glowMesh.position.set(kx, 0, kz);
      keyGlowGroup.add(glowMesh);
      keyGlows.set(p, glowMesh);
    }

    // 6. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 50;
    controls.maxDistance = 1400;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.target.set(10, 85, 0);

    controls.addEventListener("start", () => {
      setViewAngle("custom");
    });

    stateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      keyGlowGroup,
      keyGlows,
    };

    // Resize Handler
    const handleResize = () => {
      if (!container || !stateRef.current) return;
      const w = container.clientWidth || 900;
      const h = container.clientHeight || 480;
      stateRef.current.camera.aspect = w / h;
      stateRef.current.camera.updateProjectionMatrix();
      stateRef.current.renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const s = stateRef.current;
      if (s) {
        if (s.mixer) {
          s.mixer.update(delta);
        }
        if (s.cameraTargetPos) {
          s.camera.position.lerp(s.cameraTargetPos, 0.08);
          if (s.camera.position.distanceTo(s.cameraTargetPos) < 1) {
            s.cameraTargetPos = undefined;
          }
        }
        if (s.controlsTargetPos) {
          s.controls.target.lerp(s.controlsTargetPos, 0.08);
          if (s.controls.target.distanceTo(s.controlsTargetPos) < 1) {
            s.controlsTargetPos = undefined;
          }
        }
        s.controls.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Camera Angle Presets
  useEffect(() => {
    const s = stateRef.current;
    if (!s || viewAngle === "custom") return;

    if (viewAngle === "cinematic") {
      s.cameraTargetPos = new THREE.Vector3(-180, 160, 240);
      s.controlsTargetPos = new THREE.Vector3(10, 85, 0);
    } else if (viewAngle === "side") {
      s.cameraTargetPos = new THREE.Vector3(-240, 110, 70);
      s.controlsTargetPos = new THREE.Vector3(0, 80, 0);
    } else if (viewAngle === "player") {
      s.cameraTargetPos = new THREE.Vector3(0, 150, 150);
      s.controlsTargetPos = new THREE.Vector3(0, 75, -20);
    } else if (viewAngle === "top") {
      s.cameraTargetPos = new THREE.Vector3(0, 280, 40);
      s.controlsTargetPos = new THREE.Vector3(0, 75, -10);
    }
  }, [viewAngle]);

  // Frame Update: Key Glow Animation
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    const activePitches = new Map(frame.active.map((n) => [n.pitch, n.hand]));

    s.keyGlows.forEach((glowMesh, pitch) => {
      const activeHand = activePitches.get(pitch);
      const isPressed = !!activeHand;
      const mat = glowMesh.material as THREE.MeshBasicMaterial;

      if (isPressed) {
        mat.color.setHex(activeHand === "R" ? 0xff4d79 : 0x00d8f6);
        mat.opacity = 0.95;
      } else {
        mat.opacity = Math.max(0, mat.opacity - 0.15);
      }
    });

    // Sync animation speed with playing status
    if (s.action) {
      const isPlayingNotes = frame.active.length > 0;
      s.action.timeScale = isPlayingNotes ? 1.0 : 0.35;
    }
  }, [frame]);

  return (
    <div
      ref={rootRef}
      className={`relative flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "rounded-xl border border-border"
      }`}
    >
      {/* 3D Camera Angles & Controls Bar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/85 px-2.5 py-1.5 shadow-md backdrop-blur-md">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1">🎥 카메라:</span>
        <button
          type="button"
          onClick={() => setViewAngle("cinematic")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "cinematic"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          ✨ 시네마틱
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("side")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "side"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          사이드 뷰
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("player")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "player"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          연주자
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("top")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "top"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          탑다운
        </button>
        {viewAngle === "custom" && (
          <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold">
            자유 시점
          </span>
        )}

        <div className="mx-1 h-3.5 w-px bg-border" />

        {/* Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "창 모드로 복귀 (ESC)" : "3D 피아노 전체 화면"}
          className="flex items-center gap-1 rounded bg-muted/60 hover:bg-muted px-2 py-1 text-xs font-semibold text-foreground transition-all"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="size-3.5 text-amber-400" />
              <span>창 모드</span>
            </>
          ) : (
            <>
              <Maximize2 className="size-3.5 text-neutral-300" />
              <span>전체 화면</span>
            </>
          )}
        </button>
      </div>

      <div className="pointer-events-none absolute top-3 left-4 z-10 flex flex-col gap-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
        <span className="text-white/90 font-semibold">✨ 3D 콘서트 피아니스트 실황 연주</span>
        <span className="text-[10px] text-neutral-400">
          🖱️ 마우스 드래그: 360° 회전 · 휠: 확대/축소 · 우클릭: 이동
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-4 z-10 text-[11px] font-semibold tracking-wide text-lh">
        왼손 (Cyan)
      </div>
      <div className="pointer-events-none absolute right-4 bottom-3 z-10 text-[11px] font-semibold tracking-wide text-rh">
        오른손 (Coral)
      </div>

      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="h-full w-full min-h-[300px] lg:min-h-[440px] cursor-grab active:cursor-grabbing" />
    </div>
  );
}
