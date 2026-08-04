export interface Settings {
  tmdbKey: string;
  blueskyHandle: string;
  blueskyAppPassword: string;
  saveCredentials: boolean;
}

const KEY = "filmpost:settings";

const defaults: Settings = {
  tmdbKey: "",
  blueskyHandle: "",
  blueskyAppPassword: "",
  saveCredentials: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Settings): void {
  if (!settings.saveCredentials) {
    const { saveCredentials } = settings;
    localStorage.setItem(KEY, JSON.stringify({ saveCredentials }));
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(settings));
}
