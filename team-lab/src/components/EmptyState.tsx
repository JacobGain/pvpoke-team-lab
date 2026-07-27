import type { ReactNode } from "react";

export function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  actions,
}: {
  readonly icon?: ReactNode;
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <section className="empty-state">
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        <div className="empty-state__description">{description}</div>
      </div>
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </section>
  );
}
