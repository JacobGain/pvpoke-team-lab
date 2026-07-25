import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "@/app/routes/HomePage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { InventoryAnalysisPage } from "@/features/analysis/InventoryAnalysisPage";
import { InventoryFormPage } from "@/features/inventory/InventoryFormPage";
import { InventoryBackupPage } from "@/features/inventory/InventoryBackupPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { PokemonCatalogPage } from "@/features/meta/PokemonCatalogPage";

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
      path: "*",
      element: <NotFoundPage />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
