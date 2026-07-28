import {
  createBrowserRouter,
  type RouteObject,
} from "react-router";

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
} from "@/app/LazyRoutePages";
import { AppLayout } from "@/app/AppLayout";
import { HomePage } from "@/app/routes/HomePage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";

const diagnosticsRoutes: RouteObject[] = __TEAMLAB_DIAGNOSTICS__
  ? [
      {
        path: "diagnostics/simulation",
        lazy: async () => {
          const module = await import(
            "@/features/simulation/SimulationDiagnosticsPage"
          );
          return { Component: module.SimulationDiagnosticsPage };
        },
      },
    ]
  : [];

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AppLayout />,
      children: [
        {
          index: true,
          element: <HomePage />,
        },
        {
          path: "catalog",
          element: (
            <LazyRoute>
              <PokemonCatalogPage />
            </LazyRoute>
          ),
        },
        {
          path: "inventory",
          element: (
            <LazyRoute>
              <InventoryPage />
            </LazyRoute>
          ),
        },
        {
          path: "inventory/new",
          element: (
            <LazyRoute>
              <InventoryFormPage />
            </LazyRoute>
          ),
        },
        {
          path: "inventory/backup",
          element: (
            <LazyRoute>
              <InventoryBackupPage />
            </LazyRoute>
          ),
        },
        {
          path: "inventory/:inventoryId/analysis",
          element: (
            <LazyRoute>
              <InventoryAnalysisPage />
            </LazyRoute>
          ),
        },
        {
          path: "inventory/:inventoryId",
          element: (
            <LazyRoute>
              <InventoryFormPage />
            </LazyRoute>
          ),
        },
        {
          path: "teams",
          element: (
            <LazyRoute>
              <SavedTeamsPage />
            </LazyRoute>
          ),
        },
        {
          path: "teams/new",
          element: (
            <LazyRoute>
              <SavedTeamFormPage />
            </LazyRoute>
          ),
        },
        {
          path: "teams/:teamId",
          element: (
            <LazyRoute>
              <SavedTeamFormPage />
            </LazyRoute>
          ),
        },
        ...diagnosticsRoutes,
        {
          path: "teams/:teamId/simulation",
          element: (
            <LazyRoute>
              <SavedTeamSimulationPage />
            </LazyRoute>
          ),
        },
        {
          path: "recommend",
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
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
