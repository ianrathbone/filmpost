import { ReactNode } from "react";

export type FrameStatus = "auto" | "manual" | "off" | "posted";

const STATUS_LABEL: Record<FrameStatus, string> = {
  auto: "Auto-post",
  manual: "Copy / paste",
  off: "Off by default",
  posted: "Posted",
};

export function PlatformRow({
  frame,
  name,
  status,
  children,
  toggle,
}: {
  frame: string;
  name: string;
  status: FrameStatus;
  children: ReactNode;
  toggle?: ReactNode;
}) {
  return (
    <section className={`frame frame--${status}`}>
      <div className="frame__sprockets" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="frame__hole" />
        ))}
      </div>
      <div className="frame__body">
        <header className="frame__header">
          <span className="frame__number mono">{frame}</span>
          <h3 className="frame__name">{name}</h3>
          <span className={`frame__status frame__status--${status}`}>{STATUS_LABEL[status]}</span>
          {toggle}
        </header>
        <div className="frame__content">{children}</div>
      </div>
    </section>
  );
}
