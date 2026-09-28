import { useEffect, useRef, useState } from "react";

export type HubTab = "home" | "gather" | "battle" | "heroes" | "summon" | "storage" | "fusion" | "shop";

export function useHubNavigation() {
  const [mainTab, setMainTab] = useState<HubTab>("home");
  const [hubSettingsOpen, setHubSettingsOpen] = useState(false);
  const [selectedLobbyStage, setSelectedLobbyStage] = useState<number | null>(null);
  const [lobbyFormationOpen, setLobbyFormationOpen] = useState(false);
  const hubScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { hubScrollRef.current?.scrollTo(0, 0); }, [mainTab]);

  return {
    mainTab, setMainTab,
    hubSettingsOpen, setHubSettingsOpen,
    selectedLobbyStage, setSelectedLobbyStage,
    lobbyFormationOpen, setLobbyFormationOpen,
    hubScrollRef
  };
}
