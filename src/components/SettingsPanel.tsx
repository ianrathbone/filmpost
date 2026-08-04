import { Settings } from "../lib/storage";

export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="settings-overlay" role="dialog" aria-label="Settings">
      <div className="settings-panel">
        <header className="settings-panel__header">
          <h2>Keys &amp; credentials</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            &times;
          </button>
        </header>

        <p className="settings-panel__note">
          Stored only in this browser's local storage. Nothing here is sent anywhere except
          directly to TMDB or Bluesky when you trigger a lookup or a post.
        </p>

        <label className="field">
          <span>TMDB API key (v3)</span>
          <input
            type="password"
            value={settings.tmdbKey}
            onChange={(e) => set("tmdbKey", e.target.value)}
            placeholder="Used for automatic poster lookup"
          />
        </label>

        <div className="field">
          <span>TMDB account (for rating submission)</span>
          {settings.tmdbSessionId ? (
            <div className="frame__actions">
              <span className="posted-note">Connected</span>
              <button className="copy-btn" type="button" onClick={() => set("tmdbSessionId", "")}>
                Disconnect
              </button>
            </div>
          ) : (
            <span className="notion-update__hint" style={{ margin: 0 }}>
              Not connected yet, use the "Connect TMDB account" button on the TMDB frame below.
            </span>
          )}
        </div>

        <label className="field">
          <span>Bluesky handle</span>
          <input
            type="text"
            value={settings.blueskyHandle}
            onChange={(e) => set("blueskyHandle", e.target.value)}
            placeholder="rathbone.dev"
          />
        </label>

        <label className="field">
          <span>Bluesky app password</span>
          <input
            type="password"
            value={settings.blueskyAppPassword}
            onChange={(e) => set("blueskyAppPassword", e.target.value)}
            placeholder="Generated in Bluesky settings, not your account password"
          />
        </label>

        <label className="field field--checkbox">
          <input
            type="checkbox"
            checked={settings.saveCredentials}
            onChange={(e) => set("saveCredentials", e.target.checked)}
          />
          <span>Remember these in this browser between sessions</span>
        </label>
      </div>
    </div>
  );
}
