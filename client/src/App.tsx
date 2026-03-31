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
import { useEffect } from "react";

// ── Grudge Unified Auth ──
const GRUDGE_AUTH_URL = 'https://id.grudge-studio.com/auth';
function consumeGrudgeAuth() {
  if (!location.hash || !location.hash.includes('token=')) return;
  const hash = new URLSearchParams(location.hash.slice(1));
  const token = hash.get('token');
  if (!token) return;
  localStorage.setItem('grudge_auth_token', token);
  if (hash.get('grudgeId')) localStorage.setItem('grudge_id', hash.get('grudgeId')!);
  if (hash.get('name')) localStorage.setItem('grudge_username', hash.get('name')!);
  window.history.replaceState(null, '', location.pathname + location.search);
}
consumeGrudgeAuth();

export function requireGrudgeAuth() {
  if (localStorage.getItem('grudge_auth_token')) return true;
  const redirect = encodeURIComponent(window.location.href);
  window.location.href = `${GRUDGE_AUTH_URL}?redirect=${redirect}&app=dungeon-crawler`;
  return false;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/character-select" component={CharacterSelect} />
      <Route path="/create-character" component={CreateCharacter} />
      <Route path="/game" component={GamePage} />
      <Route path="/open-world" component={OpenWorldLobby} />
      <Route path="/open-world-play" component={OpenWorldPage} />
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
