import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "@/app/routes/HomePage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { InventoryAnalysisPage } from "@/features/analysis/InventoryAnalysisPage";
import { InventoryFormPage } from "@/features/inventory/InventoryFormPage";
import { InventoryBackupPage } from "@/features/inventory/InventoryBackupPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { PokemonCatalogPage } from "@/features/meta/PokemonCatalogPage";
import { RecommendationPage } from "@/features/recommendations/RecommendationPage";
import { SavedTeamSimulationPage } from "@/features/simulation/SavedTeamSimulationPage";
import { SavedTeamFormPage } from "@/features/teams/SavedTeamFormPage";
import { SavedTeamsPage } from "@/features/teams/SavedTeamsPage";
import { SimulationDiagnosticsPage } from "@/features/simulation/SimulationDiagnosticsPage";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <HomePage />,
    },
    {
      path: "/catalog",
      element: <PokemonCatalogPage />,
    },
    {
      path: "/inventory",
      element: <InventoryPage />,
    },
    {
      path: "/inventory/new",
      element: <InventoryFormPage />,
    },
    {
      path: "/inventory/backup",
      element: <InventoryBackupPage />,
    },
    {
      path: "/inventory/:inventoryId/analysis",
      element: <InventoryAnalysisPage />,
    },
    {
      path: "/inventory/:inventoryId",
      element: <InventoryFormPage />,
    },
    {
      path: "/teams",
      element: <SavedTeamsPage />,
    },
    {
      path: "/teams/new",
      element: <SavedTeamFormPage />,
    },
    {
      path: "/teams/:teamId",
      element: <SavedTeamFormPage />,
    },
    {
      path: "/diagnostics/simulation",
      element: <SimulationDiagnosticsPage />,
    },
    {
      path: "/teams/:teamId/simulation",
      element: <SavedTeamSimulationPage />,
    },
    {
      path: "/recommend",
      element: <RecommendationPage />,
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
