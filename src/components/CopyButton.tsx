import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked, fall back to a manual select prompt is unnecessary here
    }
  }

  return (
    <button className={`copy-btn${copied ? " copy-btn--done" : ""}`} onClick={handleCopy} type="button">
      {copied ? "Copied" : label}
    </button>
  );
}
