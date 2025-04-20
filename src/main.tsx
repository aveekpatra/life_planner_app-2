import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { verifyRequiredEnv } from "./utils/environment";
import "./index.css";
import App from "./App";
import Home from "./pages/Home";
import TasksPage from "./pages/TasksPage";
import ProjectsPage from "./pages/ProjectsPage";
import NotesPage from "./pages/NotesPage";
import CalendarPage from "./pages/CalendarPage";
import BookmarksPage from "./pages/BookmarksPage";

// Verify required environment variables
const envVarsConfigured = verifyRequiredEnv([
  "VITE_CONVEX_URL",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_GOOGLE_REDIRECT_URI",
]);

if (!envVarsConfigured) {
  console.error(
    "Application may not function correctly due to missing environment variables"
  );
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Define routes
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "tasks",
        element: <TasksPage />,
      },
      {
        path: "projects",
        element: <ProjectsPage />,
      },
      {
        path: "notes",
        element: <NotesPage />,
      },
      {
        path: "calendar",
        element: <CalendarPage />,
      },
      {
        path: "bookmarks",
        element: <BookmarksPage />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <RouterProvider router={router} />
    </ConvexAuthProvider>
  </StrictMode>
);
