import { Authenticated, Unauthenticated } from "convex/react";
import { ProjectsWidget } from "../components/ProjectsWidget";
import { MainLayout } from "../components/MainLayout";
import { Navigate } from "react-router-dom";

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Unauthenticated>
        <Navigate to="/" replace />
      </Unauthenticated>

      <Authenticated>
        <MainLayout>
          <div className="space-y-8 w-full max-w-6xl mx-auto">
            <ProjectsWidget />
          </div>
        </MainLayout>
      </Authenticated>
    </div>
  );
}
