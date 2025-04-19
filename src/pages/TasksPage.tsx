import { Authenticated, Unauthenticated } from "convex/react";
import { TasksWidget } from "../components/TasksWidget";
import { MainLayout } from "../components/MainLayout";
import { Navigate } from "react-router-dom";

export default function TasksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Unauthenticated>
        <Navigate to="/" replace />
      </Unauthenticated>

      <Authenticated>
        <MainLayout>
          <div className="space-y-8 w-full max-w-6xl mx-auto">
            <TasksWidget />
          </div>
        </MainLayout>
      </Authenticated>
    </div>
  );
} 