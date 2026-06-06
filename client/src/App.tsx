import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CharacterSelect from "@/pages/character-select";
import CreateCharacter from "@/pages/create-character";
import GamePage from "@/pages/game";
import SettingsPage from "@/pages/settings";
import OpenWorldPage from "@/pages/open-world";
import OpenWorldLobby from "@/pages/open-world-lobby";
import AnimationEditorPage from "@/pages/animation-editor";
import AdminPage from "@/pages/admin";
import EntityEditorPage from "@/pages/entity-editor";
import MapAdminPage from "@/pages/map-admin";
import WorldAdminPage from "@/pages/world-admin";
import WorldEditorPage from "@/pages/world-editor";
import CharacterPage from "@/pages/character";
import IslandPage from "@/pages/island";
import AIDebugPage from "@/pages/ai-debug";
import ToonAdminPage from "@/pages/toon-admin";
import GenesisPage from "@/pages/genesis";
import DungeonGamePage from "@/pages/dungeon-game";
import SandboxPage from "@/pages/sandbox";
import ArenaPage from "@/pages/arena";
import Dungeon3DPage from "@/pages/dungeon3d";
import { lazy, Suspense, useEffect } from "react";

// Lazy-load the standalone 3D scene (heavy BabylonJS import)
const GenesisPlayPage = lazy(() => import("@/pages/genesis-play"));

// ── Grudge Unified Auth ──
// Token pickup (SSO + legacy hash) runs automatically on import.
// No hard redirects — guests play immediately.
import "@/lib/grudgeBackend";
// ── ObjectStore CDN resolution (async, fire-and-forget) ──
import { initObjectStore } from "@/lib/grudge-objectstore";
initObjectStore();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/character-select" component={CharacterSelect} />
      <Route path="/create-character" component={CreateCharacter} />
      <Route path="/game" component={GamePage} />
      <Route path="/open-world" component={OpenWorldLobby} />
      <Route path="/open-world-play">{() => <OpenWorldPage />}</Route>
      <Route path="/settings" component={SettingsPage} />
      <Route path="/animation-editor" component={AnimationEditorPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/editor" component={EntityEditorPage} />
      <Route path="/mapadmin" component={MapAdminPage} />
      <Route path="/worldadmin" component={WorldAdminPage} />
      <Route path="/worldeditor" component={WorldEditorPage} />
      <Route path="/character" component={CharacterPage} />
      <Route path="/island" component={IslandPage} />
      <Route path="/genesis-admin" component={GenesisPage} />
      <Route path="/genesis/:instanceId" component={GenesisPage} />
      <Route path="/genesis-play">{() => <Suspense fallback={<div style={{background:'#000',color:'#c5a059',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'monospace'}}>Loading Genesis...</div>}><GenesisPlayPage /></Suspense>}</Route>
      <Route path="/dungeon" component={DungeonGamePage} />
      <Route path="/sandbox" component={SandboxPage} />
      <Route path="/arena" component={ArenaPage} />
      <Route path="/dungeon3d" component={Dungeon3DPage} />
      <Route path="/ai-debug" component={AIDebugPage} />
      <Route path="/toonadmin" component={ToonAdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HashRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#toonadmin") {
      window.history.replaceState({}, "", "/toonadmin");
      setLocation("/toonadmin");
    }
  }, [setLocation]);
  return null;
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <HashRedirect />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
