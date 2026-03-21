import { useState } from "react";

type UpgradeModalProps = {
  upgradeAccount: (username: string, password: string, email: string) => Promise<void>;
  onClose: () => void;
};

/** Renders the guest-account upgrade form and delegates the upgrade action to the auth layer. */
export function UpgradeModal({ upgradeAccount, onClose }: UpgradeModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (): Promise<void> => {
    try {
      await upgradeAccount(username, password, email);
      setError(null);
      onClose();
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : "Unknown error");
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="screen-card modal-card stack">
        <h1>Save Progress</h1>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="button-row">
          <button type="button" onClick={() => void handleConfirm()}>
            Confirm
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
