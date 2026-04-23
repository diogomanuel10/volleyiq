import { Route, Switch, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useAuth } from "@/hooks/useAuth";
import { useTeam } from "@/hooks/useTeam";
import { AppShell } from "@/components/layout/AppShell";
import Dashboard from "@/pages/Dashboard";
import LiveScout from "@/pages/LiveScout";
import Matches from "@/pages/Matches";
import Players from "@/pages/Players";
import PlayerDetail from "@/pages/PlayerDetail";
import MatchDay from "@/pages/MatchDay";
import ScoutingReport from "@/pages/ScoutingReport";
import Scenario from "@/pages/Scenario";
import PostMatch from "@/pages/PostMatch";
import Pricing from "@/pages/Pricing";
import SecondScreen from "@/pages/SecondScreen";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";

export default function App() {
  const { isAuthed, isLoading: authLoading } = useAuth();

  if (authLoading) return <Loading />;

  if (!isAuthed) {
    return (
      <WouterRouter hook={useHashLocation}>
        <Login />
      </WouterRouter>
    );
  }

  return <AuthedApp />;
}

function AuthedApp() {
  const { hasTeams, isLoading: teamsLoading } = useTeam();

  if (teamsLoading) return <Loading />;

  if (!hasTeams) {
    return (
      <WouterRouter hook={useHashLocation}>
        <Onboarding />
      </WouterRouter>
    );
  }

  return (
    <WouterRouter hook={useHashLocation}>
      <AppShell>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/scout/:matchId?" component={LiveScout} />
          <Route path="/matches" component={Matches} />
          <Route path="/players" component={Players} />
          <Route path="/players/:id" component={PlayerDetail} />
          <Route path="/matchday/:matchId?" component={MatchDay} />
          <Route path="/reports/:opponent?" component={ScoutingReport} />
          <Route path="/scenario" component={Scenario} />
          <Route path="/post-match/:matchId?" component={PostMatch} />
          <Route path="/second-screen/:matchId" component={SecondScreen} />
          <Route path="/pricing" component={Pricing} />
          <Route>
            <div className="p-8 text-muted-foreground">Página não encontrada.</div>
          </Route>
        </Switch>
      </AppShell>
    </WouterRouter>
  );
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      A carregar…
    </div>
  );
}
