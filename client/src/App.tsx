import { useAuth } from "./auth/useAuth";
import { EntryScreen } from "./screens/EntryScreen";
import { GameScreen } from "./screens/GameScreen";
import { LoginScreen } from "./screens/LoginScreen";

/** Renders the root application gate based purely on the resolved auth state. */
export default function App() {
  const { authState, createGuest, goToLogin, login, upgradeAccount, logout, logoutAll, handleAuthFailure } =
    useAuth();

  switch (authState.status) {
    case "loading":
      return <main>Loading...</main>;
    case "needsSelection":
      return <EntryScreen createGuest={createGuest} goToLogin={goToLogin} />;
    case "needsLogin":
      return <LoginScreen login={login} />;
    case "authenticated":
      return (
        <GameScreen
          onAuthFailure={handleAuthFailure}
          upgradeAccount={upgradeAccount}
          logout={logout}
          logoutAll={logoutAll}
        />
      );
  }
}
