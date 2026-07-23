import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "@/app/routes/HomePage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <HomePage />,
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
