import { useEffect } from "react";
import { unlockAudio } from "@/game/audio";
import { useGame } from "@/game/store";
import { GameTable } from "./GameTable";
import { RulesModal, SetupScreen, TitleScreen } from "./Screens";

export function GameApp() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    const onFirst = () => unlockAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    (window as unknown as { __game: typeof useGame }).__game = useGame;
    return () => window.removeEventListener("pointerdown", onFirst);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useGame.getState().setInspect(null);
      if (e.key === "p" || e.key === "P") {
        const st = useGame.getState();
        if (st.screen === "play" && st.state?.phase === "action") st.dispatch({ type: "pass" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {screen === "title" && <TitleScreen />}
      {screen === "setup" && <SetupScreen />}
      {screen === "play" && <GameTable />}
      <RulesModal />
    </>
  );
}
