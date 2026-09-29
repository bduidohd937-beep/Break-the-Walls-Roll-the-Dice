import { useState } from "react";
import { BATTLE_NARROW_DEFAULT_LEFT, BATTLE_WORLD_PERCENT, type BattleViewMode } from "../systems/battleCamera";

export type PauseScreen = null | "menu" | "settings" | "exit";

export function useBattleViewState() {
  const [notice, setNotice] = useState("전투 시작!");
  const [gameSpeed, setGameSpeed] = useState(5);
  const [pauseScreen, setPauseScreen] = useState<PauseScreen>(null);
  const [autoCom, setAutoCom] = useState(false);
  const [battleDeckPage, setBattleDeckPage] = useState<0 | 1>(0);
  const [battleViewMode, setBattleViewMode] = useState<BattleViewMode>("wide");
  const [battleCameraLeft, setBattleCameraLeft] = useState(BATTLE_NARROW_DEFAULT_LEFT);

  const toggleBattleView = () => {
    if (battleViewMode === "wide") setBattleCameraLeft(BATTLE_NARROW_DEFAULT_LEFT);
    setBattleViewMode(battleViewMode === "wide" ? "narrow" : "wide");
  };

  const moveBattleCamera = (cameraLeft: number) => {
    setBattleCameraLeft(Math.max(0, Math.min(BATTLE_WORLD_PERCENT, cameraLeft)));
  };

  return {
    notice, setNotice,
    gameSpeed, setGameSpeed,
    pauseScreen, setPauseScreen,
    paused: pauseScreen !== null,
    autoCom, setAutoCom,
    battleDeckPage, setBattleDeckPage,
    battleViewMode, toggleBattleView, battleCameraLeft, moveBattleCamera
  };
}
