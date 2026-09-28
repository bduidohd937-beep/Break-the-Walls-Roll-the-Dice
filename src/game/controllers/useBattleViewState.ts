import { useState } from "react";

export type PauseScreen = null | "menu" | "settings" | "exit";

export function useBattleViewState() {
  const [notice, setNotice] = useState("전투 시작!");
  const [gameSpeed, setGameSpeed] = useState(5);
  const [pauseScreen, setPauseScreen] = useState<PauseScreen>(null);
  const [autoCom, setAutoCom] = useState(false);
  const [battleDeckPage, setBattleDeckPage] = useState<0 | 1>(0);

  return {
    notice, setNotice,
    gameSpeed, setGameSpeed,
    pauseScreen, setPauseScreen,
    paused: pauseScreen !== null,
    autoCom, setAutoCom,
    battleDeckPage, setBattleDeckPage
  };
}
