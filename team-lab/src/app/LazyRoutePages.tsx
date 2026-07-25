import { lazy, Suspense, type ReactNode } from "react";

export const InventoryAnalysisPage = lazy(() =>
  import("@/features/analysis/InventoryAnalysisPage").then((module) => ({
    default: module.InventoryAnalysisPage,
  })),
);

export const InventoryFormPage = lazy(() =>
  import("@/features/inventory/InventoryFormPage").then((module) => ({
    default: module.InventoryFormPage,
  })),
);

export const InventoryBackupPage = lazy(() =>
  import("@/features/inventory/InventoryBackupPage").then((module) => ({
    default: module.InventoryBackupPage,
  })),
);

export const InventoryPage = lazy(() =>
  import("@/features/inventory/InventoryPage").then((module) => ({
    default: module.InventoryPage,
  })),
);

export const PokemonCatalogPage = lazy(() =>
  import("@/features/meta/PokemonCatalogPage").then((module) => ({
    default: module.PokemonCatalogPage,
  })),
);

export const RecommendationPage = lazy(() =>
  import("@/features/recommendations/RecommendationPage").then((module) => ({
    default: module.RecommendationPage,
  })),
);

export const SavedTeamSimulationPage = lazy(() =>
  import("@/features/simulation/SavedTeamSimulationPage").then((module) => ({
    default: module.SavedTeamSimulationPage,
  })),
);

export const SimulationDiagnosticsPage = lazy(() =>
  import("@/features/simulation/SimulationDiagnosticsPage").then((module) => ({
    default: module.SimulationDiagnosticsPage,
  })),
);

export const SavedTeamFormPage = lazy(() =>
  import("@/features/teams/SavedTeamFormPage").then((module) => ({
    default: module.SavedTeamFormPage,
  })),
);

export const SavedTeamsPage = lazy(() =>
  import("@/features/teams/SavedTeamsPage").then((module) => ({
    default: module.SavedTeamsPage,
  })),
);

export function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="route-loading" aria-live="polite">
          Loading TeamLab…
        </main>
      }
    >
      {children}
    </Suspense>
  );
}
