import { Compass } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "@/components/EmptyState";

export function NotFoundPage() {
  return (
    <main className="dashboard-page not-found-page">
      <EmptyState
        actions={
          <Link className="primary-link" to="/">
            Return to dashboard
          </Link>
        }
        description={
          <p>
            The requested TeamLab destination does not exist or may have moved.
          </p>
        }
        eyebrow="404 · Off course"
        icon={<Compass size={27} />}
        title="Page not found"
      />
    </main>
  );
}
