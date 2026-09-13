import { useEffect } from "react";
import { unlockAudio } from "@/game/audio";
import { COLLECTION_KEY } from "@/game/collection";
import { MUTE_KEY } from "@/game/mute";
import { useGame } from "@/game/store";
import { GameTable } from "./GameTable";
import { RulesModal, SetupScreen, ShopScreen, TitleScreen } from "./Screens";

export function GameApp() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    useGame.getState().hydrateMute();
    useGame.getState().hydrateCollection();
    const onStorage = (e: StorageEvent) => {
      if (e.key === MUTE_KEY) useGame.getState().hydrateMute();
      if (e.key === COLLECTION_KEY) useGame.getState().hydrateCollection();
    };
    window.addEventListener("storage", onStorage);
    const onFirst = () => unlockAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    (window as unknown as { __game: typeof useGame }).__game = useGame;
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useGame.getState().setInspect(null);
      if (e.key === "p" || e.key === "P") {
        const st = useGame.getState();
        const acting = st.state?.players[st.state.current];
        if (
          st.screen === "play" &&
          st.state?.phase === "action" &&
          acting?.kind === "human" &&
          !st.aiBusy
        ) {
          st.dispatch({ type: "pass" });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {screen === "title" && <TitleScreen />}
      {screen === "shop" && <ShopScreen />}
      {screen === "setup" && <SetupScreen />}
      {screen === "play" && <GameTable />}
      <RulesModal />
    </>
  );
}
