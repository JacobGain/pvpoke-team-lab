import { createBrowserRouter } from "react-router-dom";

import {
  InventoryAnalysisPage,
  InventoryBackupPage,
  InventoryFormPage,
  InventoryPage,
  LazyRoute,
  PokemonCatalogPage,
  RecommendationPage,
  SavedTeamFormPage,
  SavedTeamSimulationPage,
  SavedTeamsPage,
  SimulationDiagnosticsPage,
} from "@/app/LazyRoutePages";
import { HomePage } from "@/app/routes/HomePage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <HomePage />,
    },
    {
      path: "/catalog",
      element: (
        <LazyRoute>
          <PokemonCatalogPage />
        </LazyRoute>
      ),
    },
    {
      path: "/inventory",
      element: (
        <LazyRoute>
          <InventoryPage />
        </LazyRoute>
      ),
    },
    {
      path: "/inventory/new",
      element: (
        <LazyRoute>
          <InventoryFormPage />
        </LazyRoute>
      ),
    },
    {
      path: "/inventory/backup",
      element: (
        <LazyRoute>
          <InventoryBackupPage />
        </LazyRoute>
      ),
    },
    {
      path: "/inventory/:inventoryId/analysis",
      element: (
        <LazyRoute>
          <InventoryAnalysisPage />
        </LazyRoute>
      ),
    },
    {
      path: "/inventory/:inventoryId",
      element: (
        <LazyRoute>
          <InventoryFormPage />
        </LazyRoute>
      ),
    },
    {
      path: "/teams",
      element: (
        <LazyRoute>
          <SavedTeamsPage />
        </LazyRoute>
      ),
    },
    {
      path: "/teams/new",
      element: (
        <LazyRoute>
          <SavedTeamFormPage />
        </LazyRoute>
      ),
    },
    {
      path: "/teams/:teamId",
      element: (
        <LazyRoute>
          <SavedTeamFormPage />
        </LazyRoute>
      ),
    },
    {
      path: "/diagnostics/simulation",
      element: (
        <LazyRoute>
          <SimulationDiagnosticsPage />
        </LazyRoute>
      ),
    },
    {
      path: "/teams/:teamId/simulation",
      element: (
        <LazyRoute>
          <SavedTeamSimulationPage />
        </LazyRoute>
      ),
    },
    {
      path: "/recommend",
      element: (
        <LazyRoute>
          <RecommendationPage />
        </LazyRoute>
      ),
    },
    {
      path: "*",
      element: <NotFoundPage />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
