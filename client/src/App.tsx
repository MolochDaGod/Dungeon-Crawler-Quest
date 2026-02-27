import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CharacterSelect from "@/pages/character-select";
import GamePage from "@/pages/game";
import DungeonGamePage from "@/pages/dungeon-game";
import SettingsPage from "@/pages/settings";
import OpenWorldPage from "@/pages/open-world";
import AnimationEditorPage from "@/pages/animation-editor";
import AdminPage from "@/pages/admin";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/character-select" component={CharacterSelect} />
      <Route path="/game" component={GamePage} />
      <Route path="/dungeon" component={DungeonGamePage} />
      <Route path="/open-world" component={OpenWorldPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/animation-editor" component={AnimationEditorPage} />
      <Route path="/admin" component={AdminPage} />
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
