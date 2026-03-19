import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CharacterSelect from "@/pages/character-select";
import GamePage from "@/pages/game";
import SettingsPage from "@/pages/settings";
import OpenWorldPage from "@/pages/open-world";
import AnimationEditorPage from "@/pages/animation-editor";
import AdminPage from "@/pages/admin";
import EntityEditorPage from "@/pages/entity-editor";
import MapAdminPage from "@/pages/map-admin";
import WorldAdminPage from "@/pages/world-admin";
import WorldEditorPage from "@/pages/world-editor";
import CharacterPage from "@/pages/character";
import IslandPage from "@/pages/island";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/character-select" component={CharacterSelect} />
      <Route path="/game" component={GamePage} />
      <Route path="/open-world" component={OpenWorldPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/animation-editor" component={AnimationEditorPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/editor" component={EntityEditorPage} />
      <Route path="/mapadmin" component={MapAdminPage} />
      <Route path="/worldadmin" component={WorldAdminPage} />
      <Route path="/worldeditor" component={WorldEditorPage} />
      <Route path="/character" component={CharacterPage} />
      <Route path="/island" component={IslandPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
