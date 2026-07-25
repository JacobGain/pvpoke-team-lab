import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  aside,
}: {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly back?: { readonly to: string; readonly label: string };
  readonly aside?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        {back ? (
          <Link className="back-link" to={back.to}>
            ← {back.label}
          </Link>
        ) : null}
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? (
          <div className="page-header__description">{description}</div>
        ) : null}
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
      {aside ? <div className="page-header__aside">{aside}</div> : null}
    </header>
  );
}
