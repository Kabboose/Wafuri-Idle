import { useState } from "react";

type LoginScreenProps = {
  login: (username: string, password: string) => Promise<void>;
};

/** Renders the credential form used to enter the explicit login flow. */
export function LoginScreen({ login }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await login(username, password);
  };

  return (
    <main className="screen-shell">
      <section className="screen-card">
        <h1>Login</h1>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit">Login</button>
        </form>
      </section>
    </main>
  );
}
