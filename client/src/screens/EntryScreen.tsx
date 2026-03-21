type EntryScreenProps = {
  createGuest: () => Promise<void>;
  goToLogin: () => void;
};

/** Renders the explicit auth-entry choice between guest creation and login. */
export function EntryScreen({ createGuest, goToLogin }: EntryScreenProps) {
  return (
    <main className="screen-shell">
      <section className="screen-card stack">
        <h1>Wafuri-Idle</h1>
        <p>Choose how you want to enter the game.</p>
        <div className="button-row">
          <button type="button" onClick={() => void createGuest()}>
            Continue as Guest
          </button>
          <button type="button" className="secondary-button" onClick={goToLogin}>
            Login
          </button>
        </div>
      </section>
    </main>
  );
}
