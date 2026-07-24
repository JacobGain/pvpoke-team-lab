import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "@/app/routes/HomePage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { InventoryPersistencePage } from "@/features/inventory/InventoryPersistencePage";
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
      element: <InventoryPersistencePage />,
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
