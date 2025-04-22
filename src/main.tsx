import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { verifyRequiredEnv } from "./utils/environment";
import "./index.css";
import App from "./App";
import Home from "./pages/Home";
import TasksPage from "./pages/TasksPage";
import ProjectsPage from "./pages/ProjectsPage";
import NotesPage from "./pages/NotesPage";
import CalendarPage from "./pages/CalendarPage";
import BookmarksPage from "./pages/BookmarksPage";
import { GoogleAuthCallback } from "./components/GoogleAuthCallback";

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

// Wrapper component for handling authentication state from location
function AppWithAuthStateHandling() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have auth state in the location
    if (location.state?.authCode) {
      const { authCode } = location.state;
      console.log("Found auth code in location state, handling authentication");

      // Clear the auth code from location state to prevent reprocessing
      navigate(location.pathname, { replace: true, state: {} });

      // Dispatch a custom event that the GoogleCalendarService can listen for
      window.dispatchEvent(
        new CustomEvent("GOOGLE_AUTH_DIRECT", {
          detail: { code: authCode },
        })
      );
    }
  }, [location, navigate]);

  return <App />;
}

// Define routes
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppWithAuthStateHandling />,
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
  // Add a separate route for Google Auth callback
  {
    path: "/auth/google/callback",
    element: <GoogleAuthCallback />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <RouterProvider router={router} />
    </ConvexAuthProvider>
  </StrictMode>
);
