import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Equipment = {
  id: string;
  name: string;
  type: "도끼" | "곡괭이" | "삽" | "칼" | "낚싯대";
  grade: "일반" | "고급" | "희귀" | "영웅" | "전설" | "신화";
  bonus: number;
};

type SaveData = {
  gold: number;
  wood: number;
  stone: number;
  dirt: number;
  fish: number;
  food: number;
  farmSeeds: Record<CropType, number>;
  farmPlots: FarmPlot[];
  toolLevel: number;
  toolName: string;
  inventory: Equipment[];
  equippedToolId: string | null;
  equippedTools: Record<Equipment["type"], string | null>;
};

type ResourceType = "wood" | "stone" | "dirt" | "fish";
type CropType = "밀" | "당근" | "감자";
type FarmPlot = { crop: CropType | null; plantedAt: number | null; readyAt: number | null };
const CROP_CONFIG: Record<CropType, { icon: string; time: number; yield: number }> = {
  밀: { icon: "🌾", time: 12000, yield: 3 },
  당근: { icon: "🥕", time: 18000, yield: 5 },
  감자: { icon: "🥔", time: 24000, yield: 7 },
};
function resourceToolType(type: ResourceType): Equipment["type"] { if (type === "wood") return "도끼"; if (type === "stone") return "곡괭이"; if (type === "dirt") return "삽"; return "낚싯대"; }

const SAVE_KEY = "break-the-walls-roll-the-dice-v1";
const STARTING_SAVE: SaveData = {
  gold: 0,
  wood: 0,
  stone: 0,
  dirt: 0,
  fish: 0,
  food: 0,
  farmSeeds: { 밀: 3, 당근: 3, 감자: 3 },
  farmPlots: Array.from({ length: 6 }, () => ({ crop: null, plantedAt: null, readyAt: null })),
  toolLevel: 1,
  toolName: "맨손",
  inventory: [],
  equippedToolId: null,
  equippedTools: { 도끼: null, 곡괭이: null, 삽: null, 칼: null, 낚싯대: null },
};

const EQUIPMENT_TYPES: Equipment["type"][] = ["도끼", "곡괭이", "삽", "칼", "낚싯대"];
const EQUIPMENT_GRADES: { grade: Equipment["grade"]; chance: number; bonus: number }[] = [
  { grade: "일반", chance: 0.5, bonus: 1 }, { grade: "고급", chance: 0.25, bonus: 2 },
  { grade: "희귀", chance: 0.14, bonus: 4 }, { grade: "영웅", chance: 0.07, bonus: 7 },
  { grade: "전설", chance: 0.035, bonus: 12 }, { grade: "신화", chance: 0.005, bonus: 20 },
];

function makeEquipment(): Equipment {
  const roll = Math.random(); let cursor = 0;
  const picked = EQUIPMENT_GRADES.find((entry) => { cursor += entry.chance; return roll < cursor; }) ?? EQUIPMENT_GRADES[0];
  const type = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];
  return { id: crypto.randomUUID(), name: `${picked.grade} ${type}`, type, grade: picked.grade, bonus: picked.bonus };
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return STARTING_SAVE;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      gold: Number(parsed.gold) || 0,
      wood: Number(parsed.wood) || 0,
      stone: Number(parsed.stone) || 0,
      dirt: Number((parsed as Partial<SaveData>).dirt) || 0,
      fish: Number((parsed as Partial<SaveData>).fish) || 0,
      food: Number((parsed as Partial<SaveData>).food) || 0,
      farmSeeds: parsed.farmSeeds && typeof parsed.farmSeeds === "object" ? {
        밀: Number(parsed.farmSeeds.밀) || 0,
        당근: Number(parsed.farmSeeds.당근) || 0,
        감자: Number(parsed.farmSeeds.감자) || 0,
      } : { ...STARTING_SAVE.farmSeeds },
      farmPlots: Array.isArray(parsed.farmPlots) && parsed.farmPlots.length === 6
        ? parsed.farmPlots.map((plot) => ({
            crop: plot?.crop === "밀" || plot?.crop === "당근" || plot?.crop === "감자" ? plot.crop : null,
            plantedAt: typeof plot?.plantedAt === "number" ? plot.plantedAt : null,
            readyAt: typeof plot?.readyAt === "number" ? plot.readyAt : null,
          }))
        : STARTING_SAVE.farmPlots,
      toolLevel: Math.max(1, Number(parsed.toolLevel) || 1),
      toolName: typeof parsed.toolName === "string" ? parsed.toolName : "맨손",
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory as Equipment[] : [],
      equippedToolId: typeof parsed.equippedToolId === "string" ? parsed.equippedToolId : null,
      equippedTools: parsed.equippedTools && typeof parsed.equippedTools === "object" ? { 도끼: parsed.equippedTools.도끼 ?? null, 곡괭이: parsed.equippedTools.곡괭이 ?? null, 삽: parsed.equippedTools.삽 ?? null, 칼: parsed.equippedTools.칼 ?? null, 낚싯대: parsed.equippedTools.낚싯대 ?? null } : { ...STARTING_SAVE.equippedTools },
    };
  } catch {
    return STARTING_SAVE;
  }
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [message, setMessage] = useState("나무와 바위를 클릭해서 첫 자본을 만들어보세요.");
  const [shopRoll, setShopRoll] = useState("장비를 뽑아보세요.");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"estate" | "gather" | "farm">("estate");
  const [farmTick, setFarmTick] = useState(Date.now());
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);
  const messageTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  useEffect(() => {
    const timer = window.setInterval(() => setFarmTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

    const makeDirt = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); group.userData.resourceType = "dirt" satisfies ResourceType;
      const soil = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 2.2), new THREE.MeshStandardMaterial({ color: "#8b5a3c", roughness: 1 }));
      soil.position.y = 0.3; group.add(soil); scene.add(group); resources.push(group);
    };
    const makeFishingSpot = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); group.userData.resourceType = "fish" satisfies ResourceType;
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.18, 20), new THREE.MeshStandardMaterial({ color: "#3d8fbd", roughness: 0.7 }));
      pond.position.y = 0.08; group.add(pond); scene.add(group); resources.push(group);
    };
    [[-2, -8, 1], [4, 7, 0.9], [11, -5, 0.85]].forEach(([x, z, scale]) => makeDirt(x, z, scale));
    [[-8, -1, 1], [6, -8, 0.9]].forEach(([x, z, scale]) => makeFishingSpot(x, z, scale));
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
    let cameraElevation = 0.78;
    let cameraRadius = 23;
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    let dragging = false;
    let moved = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const updateCamera = () => {
      const horizontalRadius = cameraRadius * Math.cos(cameraElevation);
      camera.position.set(
        Math.cos(cameraAzimuth) * horizontalRadius,
        cameraRadius * Math.sin(cameraElevation),
        Math.sin(cameraAzimuth) * horizontalRadius,
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
        const currentSave = saveRef.current;
        const requiredType = resourceToolType(type);
        const equipped = currentSave.inventory.find((item) => item.id === currentSave.equippedTools[requiredType]);
        if (!equipped) { showMessage(`⚠️ ${requiredType}가 필요합니다.`); break; }
        const amount = equipped.bonus;
        resource.userData.cooldown = true;
        resource.visible = false;

        setSave((prev) =>
          type === "wood"
            ? { ...prev, wood: prev.wood + amount }
            : type === "stone" ? { ...prev, stone: prev.stone + amount } : type === "dirt" ? { ...prev, dirt: prev.dirt + amount } : { ...prev, fish: prev.fish + amount },
        );

        showMessage(type === "wood" ? `🌲 목재 +${amount}` : type === "stone" ? `🪨 석재 +${amount}` : type === "dirt" ? `🟫 흙 +${amount}` : `🐟 물고기 +${amount}`);

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
      cameraElevation = THREE.MathUtils.clamp(cameraElevation + dy * 0.006, 0.32, 1.28);
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

  const rollTool = () => {
    const cost = 50 + save.inventory.length * 25;
    if (save.gold < cost) {
      showMessage(`골드가 부족합니다. 필요 골드: ${cost}G`);
      return;
    }
    const equipment = makeEquipment();
    setSave((prev) => ({ ...prev, gold: prev.gold - cost, inventory: [...prev.inventory, equipment] }));
    setShopRoll(`🎁 ${equipment.name} 획득! 장비 탭에서 장착하세요.`);
    showMessage(`🎁 ${equipment.name} 획득! 채집 보너스 +${equipment.bonus}`);
  };

  const equipTool = (equipmentId: string) => {
    const equipment = save.inventory.find((item) => item.id === equipmentId);
    if (!equipment) return;
    setSave((prev) => ({ ...prev, toolLevel: equipment.bonus, toolName: equipment.name, equippedToolId: equipment.id, equippedTools: { ...prev.equippedTools, [equipment.type]: equipment.id } }));
    showMessage(`⚒️ ${equipment.name} 장착! 채집량 +${equipment.bonus}`);
  };

  const collectFromGatherTab = (type: ResourceType) => {
    const requiredType = resourceToolType(type);
    const currentSave = saveRef.current;
    const equipped = currentSave.inventory.find((item) => item.id === currentSave.equippedTools[requiredType]);
    if (!equipped) {
      showMessage("⚠️ " + requiredType + "가 필요합니다.");
      return;
    }
    const amount = equipped.bonus;
    setSave((prev) => type === "wood"
      ? { ...prev, wood: prev.wood + amount }
      : type === "stone"
        ? { ...prev, stone: prev.stone + amount }
        : type === "dirt"
          ? { ...prev, dirt: prev.dirt + amount }
          : { ...prev, fish: prev.fish + amount });
    const label = type === "wood" ? "목재" : type === "stone" ? "석재" : type === "dirt" ? "흙" : "물고기";
    showMessage("⛏️ " + label + " +" + amount);
  };

  const plantCrop = (index: number, crop: CropType) => {
    const plot = save.farmPlots[index];
    if (!plot || plot.crop) return;
    if (save.farmSeeds[crop] <= 0) {
      showMessage("🌱 " + crop + " 씨앗이 없습니다.");
      return;
    }
    const now = Date.now();
    const readyAt = now + CROP_CONFIG[crop].time;
    setSave((prev) => ({
      ...prev,
      farmSeeds: { ...prev.farmSeeds, [crop]: prev.farmSeeds[crop] - 1 },
      farmPlots: prev.farmPlots.map((item, i) => i === index ? { crop, plantedAt: now, readyAt } : item),
    }));
    showMessage("🌱 " + crop + "를 심었습니다.");
  };

  const harvestCrop = (index: number) => {
    const plot = save.farmPlots[index];
    if (!plot.crop || !plot.readyAt || farmTick < plot.readyAt) return;
    const crop = plot.crop;
    const config = CROP_CONFIG[crop];
    setSave((prev) => ({
      ...prev,
      food: prev.food + config.yield,
      farmSeeds: { ...prev.farmSeeds, [crop]: prev.farmSeeds[crop] + 1 },
      farmPlots: prev.farmPlots.map((item, i) => i === index ? { crop: null, plantedAt: null, readyAt: null } : item),
    }));
    showMessage("🌾 농산물 +" + config.yield + " · 씨앗 1개를 회수했습니다.");
  };

  const sellAll = () => {
    const revenue = save.wood * 5 + save.stone * 8 + save.dirt * 3 + save.fish * 12 + save.food * 10;
    if (revenue <= 0) {
      showMessage("팔 자원이 없습니다.");
      return;
    }

    setSave((prev) => ({
      ...prev,
      gold: prev.gold + revenue,
      wood: 0,
      stone: 0,
      dirt: 0,
      fish: 0,
      food: 0,
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
          <div className="resource-pill stone">🪨 <b>{save.stone}</b><small>석재</small></div><div className="resource-pill wood">🟫 <b>{save.dirt}</b><small>흙</small></div><div className="resource-pill stone">🐟 <b>{save.fish}</b><small>물고기</small></div>
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

      <section className="side-panel tool-panel">
        <div className="shop-title">
          <span>🎰 장비 뽑기</span>
          <small>채집 강화</small>
        </div>
        <div className="tool-status">
          <b>{save.toolName}</b>
          <span>채집량 +{save.toolLevel}</span>
        </div>
        <button className="inventory-button" onClick={() => setInventoryOpen(true)}>🎒 장비 보관함 {save.inventory.length > 0 ? `(${save.inventory.length})` : ""}</button>
        <p className="roll-result">{shopRoll}</p>
        <button className="roll-button" onClick={rollTool}>장비 뽑기 · {50 + save.inventory.length * 25}G</button>
        {inventoryOpen && null}
      </section>

      <section className="side-panel shop-panel">
        <div className="shop-title">
          <span>🛒 초보 상점</span>
          <small>판매</small>
        </div>
        <div className="sale-row"><span>🌲 목재</span><b>{save.wood} × 5G</b></div>
        <div className="sale-row"><span>🪨 석재</span><b>{save.stone} × 8G</b></div><div className="sale-row"><span>🟫 흙</span><b>{save.dirt} × 3G</b></div><div className="sale-row"><span>🐟 물고기</span><b>{save.fish} × 12G</b></div>
        <button className="sell-button" onClick={sellAll}>전부 판매하기</button>
        <button className="reset-button" onClick={resetGame}>저장 초기화</button>
      </section>

      {inventoryOpen && (
        <section className="equipment-screen">
          <div className="equipment-screen-header">
            <div>
              <div className="eyebrow">EQUIPMENT · ARMORY</div>
              <h2>🎒 장비 보관함</h2>
              <p>뽑은 장비를 확인하고 원하는 장비를 장착하세요.</p>
            </div>
            <button className="close-equipment" onClick={() => setInventoryOpen(false)}>← 영지로 돌아가기</button>
          </div>
          <div className="equipment-slots">
            {EQUIPMENT_TYPES.map((type) => {
              const equipped = save.inventory.find((item) => item.id === save.equippedTools[type]);
              const icon = type === "도끼" ? "🪓" : type === "곡괭이" ? "⛏️" : type === "삽" ? "🛠️" : type === "칼" ? "⚔️" : "🎣";
              return <div className="equipment-slot" key={type}><div className="slot-icon">{icon}</div><span>{type} 슬롯</span><b>{equipped?.name ?? "비어 있음"}</b><small>{equipped ? "채집량 +" + equipped.bonus : "장비를 장착하세요"}</small></div>;
            })}
          </div>
          <div className="equipment-summary">
            <div><span>현재 장착</span><b>{save.toolName}</b><small>채집량 +{save.toolLevel}</small></div>
            <div><span>보유 장비</span><b>{save.inventory.length}</b><small>개</small></div>
          </div>
          <div className="equipment-grid">
            {save.inventory.length === 0 ? (
              <div className="empty-inventory large">아직 보유 장비가 없습니다.<br />영지에서 장비를 뽑아보세요.</div>
            ) : save.inventory.map((item) => (
              <article className={`equipment-card-large ${save.equippedToolId === item.id ? "equipped" : ""}`} key={item.id}>
                <div className="equipment-icon">{item.type === "도끼" ? "🪓" : item.type === "곡괭이" ? "⛏️" : item.type === "삽" ? "🛠️" : item.type === "칼" ? "⚔️" : "🎣"}</div>
                <div className={`equipment-grade grade-${item.grade}`}>{item.grade}</div>
                <h3>{item.name}</h3>
                <div className="equipment-bonus">채집량 +{item.bonus}</div>
                <div className="equipment-type">{item.type}</div>
                <button onClick={() => equipTool(item.id)}>{save.equippedToolId === item.id ? "✓ 장착 중" : "장착하기"}</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {!inventoryOpen && activeTab === "gather" && (
        <section className="mode-screen gather-screen">
          <div className="mode-screen-inner">
            <div className="mode-heading">
              <div>
                <div className="eyebrow">GATHERING · RESOURCE ZONE</div>
                <h2>⛏️ 채집</h2>
                <p>채집 장소를 한곳에 모아 필요한 장비와 생산량을 확인하세요.</p>
              </div>
              <div className="mode-stat">장비 보너스는 실제 채집량에 적용됩니다.</div>
            </div>
            <div className="gather-grid">
              {([
                ["wood", "🌲", "벌목장", "목재", "도끼", save.wood, "5G"],
                ["stone", "🪨", "광산", "석재", "곡괭이", save.stone, "8G"],
                ["dirt", "🟫", "토지", "흙", "삽", save.dirt, "3G"],
                ["fish", "🐟", "낚시터", "물고기", "낚싯대", save.fish, "12G"],
              ] as [ResourceType, string, string, string, Equipment["type"], number, string][]).map(([type, icon, place, label, tool, count, price]) => {
                const equipped = save.inventory.find((item) => item.id === save.equippedTools[tool]);
                return (
                  <article className="gather-card" key={type}>
                    <div className="gather-art">{icon}</div>
                    <div className="gather-card-copy">
                      <span>{place}</span>
                      <h3>{label}</h3>
                      <small>{tool} 필요 · 판매 {price}</small>
                    </div>
                    <div className="gather-card-bottom">
                      <b>보유 {count}</b>
                      <span>{equipped ? "+" + equipped.bonus + " /회" : "장비 없음"}</span>
                    </div>
                    <button disabled={!equipped} onClick={() => collectFromGatherTab(type)}>
                      {equipped ? "⛏️ " + label + " 채집" : "🎒 " + tool + " 장착 필요"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {!inventoryOpen && activeTab === "farm" && (
        <section className="mode-screen farm-screen">
          <div className="mode-screen-inner">
            <div className="mode-heading">
              <div>
                <div className="eyebrow">FARM · GROW & HARVEST</div>
                <h2>🌾 농장</h2>
                <p>씨앗을 심고 기다렸다가 수확하세요. 나중에는 농부와 자동화 시설로 확장합니다.</p>
              </div>
              <div className="farm-seeds">
                <span>🌾 {save.farmSeeds.밀}</span>
                <span>🥕 {save.farmSeeds.당근}</span>
                <span>🥔 {save.farmSeeds.감자}</span>
                <b>창고 농산물 {save.food}</b>
              </div>
            </div>
            <div className="farm-grid">
              {save.farmPlots.map((plot, index) => {
                const remaining = plot.readyAt ? Math.max(0, plot.readyAt - farmTick) : 0;
                const ready = Boolean(plot.crop && remaining <= 0);
                return (
                  <article className={"farm-plot " + (plot.crop ? "planted" : "empty")} key={index}>
                    <div className="plot-number">밭 {index + 1}</div>
                    <div className="plot-art">{plot.crop ? CROP_CONFIG[plot.crop].icon : "🟫"}</div>
                    {plot.crop ? (
                      <>
                        <h3>{plot.crop}</h3>
                        <p>{ready ? "수확 가능 · +" + CROP_CONFIG[plot.crop].yield + " 농산물" : Math.ceil(remaining / 1000) + "초 후 수확"}</p>
                        <button disabled={!ready} onClick={() => harvestCrop(index)}>{ready ? "🌾 수확하기" : "성장 중..."}</button>
                      </>
                    ) : (
                      <>
                        <h3>빈 밭</h3>
                        <p>씨앗을 선택해서 심으세요.</p>
                        <div className="seed-actions">
                          {(Object.keys(CROP_CONFIG) as CropType[]).map((crop) => (
                            <button key={crop} disabled={save.farmSeeds[crop] <= 0} onClick={() => plantCrop(index, crop)}>
                              {CROP_CONFIG[crop].icon} {crop}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {!inventoryOpen && (
        <nav className="bottom-nav">
          <button className={activeTab === "estate" ? "active" : ""} onClick={() => setActiveTab("estate")}><span>🏰</span>영지</button>
          <button className={activeTab === "gather" ? "active" : ""} onClick={() => setActiveTab("gather")}><span>⛏️</span>채집</button>
          <button className={activeTab === "farm" ? "active" : ""} onClick={() => setActiveTab("farm")}><span>🌾</span>농장</button>
          <button onClick={() => setInventoryOpen(true)}><span>🎒</span>장비</button>
        </nav>
      )}

      <div className="toast">{message}</div>

      <div className="control-hint">
        <b>🖱 클릭 / 👆 터치</b>
        <span>나무와 바위를 직접 눌러 채집하세요.</span>
      </div>
    </main>
  );
}

export default App;
