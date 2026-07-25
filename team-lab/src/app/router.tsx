import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "@/app/routes/HomePage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { InventoryFormPage } from "@/features/inventory/InventoryFormPage";
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
