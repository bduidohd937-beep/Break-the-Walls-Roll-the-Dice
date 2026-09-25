import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type SaveData = {
  gold: number;
  wood: number;
  stone: number;
};

type ResourceType = "wood" | "stone";

const SAVE_KEY = "break-the-walls-roll-the-dice-v1";
const STARTING_SAVE: SaveData = { gold: 0, wood: 0, stone: 0 };

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return STARTING_SAVE;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      gold: Number(parsed.gold) || 0,
      wood: Number(parsed.wood) || 0,
      stone: Number(parsed.stone) || 0,
    };
  } catch {
    return STARTING_SAVE;
  }
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [message, setMessage] = useState("나무와 바위를 클릭해서 첫 자본을 만들어보세요.");
  const messageTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  const showMessage = (text: string) => {
    setMessage(text);
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => {
      setMessage("다시 채집하려면 나무나 바위를 클릭하세요.");
    }, 1800);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#8fc8e9");

    const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100);
    camera.position.set(15, 17, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight("#ffffff", "#64748b", 2.2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#fff6df", 3.2);
    sun.position.set(8, 18, 10);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.8, 24),
      new THREE.MeshStandardMaterial({ color: "#6da34d", roughness: 1 }),
    );
    ground.position.y = -0.4;
    ground.receiveShadow = true;
    scene.add(ground);

    const path = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.18, 4.2),
      new THREE.MeshStandardMaterial({ color: "#c9aa72", roughness: 1 }),
    );
    path.position.set(0, 0.05, 0);
    scene.add(path);

    const resources: THREE.Group[] = [];
    const timers = new Set<number>();

    const makeTree = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.scale.setScalar(scale);
      group.userData.resourceType = "wood" satisfies ResourceType;

      const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 2.4, 0.8),
        new THREE.MeshStandardMaterial({ color: "#7a4d2b", roughness: 1 }),
      );
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      group.add(trunk);

      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.75, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: "#2f7d32", roughness: 1 }),
      );
      leaves.position.y = 3.4;
      leaves.castShadow = true;
      group.add(leaves);

      scene.add(group);
      resources.push(group);
    };

    const makeRock = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.scale.setScalar(scale);
      group.userData.resourceType = "stone" satisfies ResourceType;

      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.25, 0),
        new THREE.MeshStandardMaterial({ color: "#66717c", roughness: 1 }),
      );
      rock.scale.set(1.15, 0.8, 1);
      rock.position.y = 1;
      rock.castShadow = true;
      group.add(rock);

      const ore = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.18, 0.25),
        new THREE.MeshStandardMaterial({ color: "#b8c2cc", roughness: 0.8 }),
      );
      ore.position.set(0.45, 1.25, 0.25);
      ore.rotation.y = 0.5;
      group.add(ore);

      scene.add(group);
      resources.push(group);
    };

    [
      [-10, -7, 1.05],
      [-6.5, 6, 0.9],
      [7.5, -6, 1],
      [11, 6, 0.85],
      [2, 8, 0.8],
    ].forEach(([x, z, scale]) => makeTree(x, z, scale));

    [
      [-10, 3, 1],
      [-4, -7, 0.9],
      [8.5, 5.5, 1.05],
      [10, -1, 0.8],
    ].forEach(([x, z, scale]) => makeRock(x, z, scale));

    const castle = new THREE.Group();
    castle.position.set(0, 0, 0);

    const castleBase = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 2.5, 5.6),
      new THREE.MeshStandardMaterial({ color: "#d5d0c5", roughness: 0.9 }),
    );
    castleBase.position.y = 1.25;
    castleBase.castShadow = true;
    castle.add(castleBase);

    const towerPositions: [number, number][] = [
      [-2.7, -2.7],
      [2.7, -2.7],
      [-2.7, 2.7],
      [2.7, 2.7],
    ];

    towerPositions.forEach(([x, z]) => {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 4.5, 1.65),
        new THREE.MeshStandardMaterial({ color: "#b9b4aa", roughness: 0.95 }),
      );
      tower.position.set(x, 2.25, z);
      tower.castShadow = true;
      castle.add(tower);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.25, 1.7, 4),
        new THREE.MeshStandardMaterial({ color: "#6d4a35", roughness: 1 }),
      );
      roof.position.set(x, 5.35, z);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      castle.add(roof);
    });

    scene.add(castle);

    const shop = new THREE.Group();
    shop.position.set(-7.5, 0, 0);
    const shopBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 2.8, 3.8),
      new THREE.MeshStandardMaterial({ color: "#d08b45", roughness: 1 }),
    );
    shopBody.position.y = 1.4;
    shopBody.castShadow = true;
    shop.add(shopBody);

    const shopRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.1, 2.4, 4),
      new THREE.MeshStandardMaterial({ color: "#8b3f32", roughness: 1 }),
    );
    shopRoof.position.y = 4;
    shopRoof.rotation.y = Math.PI / 4;
    shopRoof.castShadow = true;
    shop.add(shopRoof);
    scene.add(shop);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let cameraAzimuth = Math.PI / 4;
    let cameraRadius = 23;
    const cameraHeight = 18;
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    let dragging = false;
    let moved = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const updateCamera = () => {
      camera.position.set(
        Math.cos(cameraAzimuth) * cameraRadius,
        cameraHeight,
        Math.sin(cameraAzimuth) * cameraRadius,
      );
      camera.lookAt(cameraTarget);
    };

    const findResource = (object: THREE.Object3D | null) => {
      let current = object;
      while (current) {
        if (current.userData.resourceType) return current;
        current = current.parent;
      }
      return null;
    };

    const collectAtPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);

      for (const hit of hits) {
        const resource = findResource(hit.object);
        if (!resource || resource.userData.cooldown) continue;

        const type = resource.userData.resourceType as ResourceType;
        resource.userData.cooldown = true;
        resource.visible = false;

        setSave((prev) =>
          type === "wood"
            ? { ...prev, wood: prev.wood + 1 }
            : { ...prev, stone: prev.stone + 1 },
        );

        showMessage(type === "wood" ? "🌲 목재 +1" : "🪨 석재 +1");

        const timer = window.setTimeout(() => {
          resource.visible = true;
          resource.userData.cooldown = false;
          timers.delete(timer);
        }, 850);
        timers.add(timer);
        break;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;

      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (!moved) return;

      cameraAzimuth -= dx * 0.008;
      updateCamera();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;

      if (!moved) {
        collectAtPointer(event);
      }

      renderer.domElement.releasePointerCapture?.(event.pointerId);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    let frame = 0;
    const animate = () => {
      const time = performance.now() * 0.001;
      resources.forEach((resource, index) => {
        if (resource.visible) {
          resource.rotation.y = Math.sin(time * 0.35 + index) * 0.025;
        }
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    updateCamera();
    animate();

    const onResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const aspect = width / Math.max(height, 1);
      const view = 10;
      camera.left = -view * aspect;
      camera.right = view * aspect;
      camera.top = view;
      camera.bottom = -view;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
      timers.forEach((timer) => window.clearTimeout(timer));
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const sellAll = () => {
    const revenue = save.wood * 5 + save.stone * 8;
    if (revenue <= 0) {
      showMessage("팔 자원이 없습니다.");
      return;
    }

    setSave((prev) => ({
      gold: prev.gold + revenue,
      wood: 0,
      stone: 0,
    }));
    showMessage(`💰 자원을 팔아 골드 +${revenue}`);
  };

  const resetGame = () => {
    if (!window.confirm("현재 저장 데이터를 초기화할까요?")) return;
    localStorage.removeItem(SAVE_KEY);
    setSave(STARTING_SAVE);
    showMessage("새 영지를 시작했습니다.");
  };

  return (
    <main className="game-shell">
      <div ref={mountRef} className="world" />

      <header className="hud">
        <div className="brand">
          <div className="brand-mark">🏰</div>
          <div>
            <strong>성벽을 부수고 주사위를 던져라</strong>
            <span>나무 베다 지치면 알바를 쓰고, 결국 대기업 회장이 된다.</span>
          </div>
        </div>

        <div className="resources">
          <div className="resource-pill gold">💰 <b>{save.gold.toLocaleString()}</b><small>골드</small></div>
          <div className="resource-pill wood">🌲 <b>{save.wood}</b><small>목재</small></div>
          <div className="resource-pill stone">🪨 <b>{save.stone}</b><small>석재</small></div>
        </div>
      </header>

      <section className="side-panel mission-panel">
        <div className="eyebrow">PHASE 1 · 생존 노동</div>
        <h1>첫 자본을 만들어라</h1>
        <p>영지의 자원을 직접 캐서 상점에 팔아 골드를 확보하세요.</p>
        <div className="objective">
          <span>🌲 나무</span>
          <b>+1 목재</b>
        </div>
        <div className="objective">
          <span>🪨 바위</span>
          <b>+1 석재</b>
        </div>
        <div className="objective">
          <span>🛒 상점</span>
          <b>목재 5G · 석재 8G</b>
        </div>
      </section>

      <section className="side-panel shop-panel">
        <div className="shop-title">
          <span>🛒 초보 상점</span>
          <small>판매</small>
        </div>
        <div className="sale-row"><span>🌲 목재</span><b>{save.wood} × 5G</b></div>
        <div className="sale-row"><span>🪨 석재</span><b>{save.stone} × 8G</b></div>
        <button className="sell-button" onClick={sellAll}>전부 판매하기</button>
        <button className="reset-button" onClick={resetGame}>저장 초기화</button>
      </section>

      <div className="toast">{message}</div>

      <div className="control-hint">
        <b>🖱 클릭 / 👆 터치</b>
        <span>나무와 바위를 직접 눌러 채집하세요.</span>
      </div>
    </main>
  );
}

export default App;
