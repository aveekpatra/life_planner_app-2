import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignInForm } from "../SignInForm";
import { Toaster } from "../components/ui/toaster";
import { QuickCapture } from "../components/QuickCapture";
import { TasksWidget } from "../components/TasksWidget";
import { ProjectsWidget } from "../components/ProjectsWidget";
import { CalendarWidget } from "../components/CalendarWidget";
import { NotesWidget } from "../components/NotesWidget";
import { Card, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { useToast } from "../hooks/use-toast";
import { MainLayout } from "../components/MainLayout";

export default function Home() {
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-background">
      <Content />
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8 text-center">
          <Card className="w-full max-w-md apple-card">
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <h1 className="text-3xl font-medium text-foreground">
                  Welcome to Life Planner
                </h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Sign in to start organizing your life with an elegant, modern
                  interface
                </p>
              </div>
              <div className="mt-8">
                <SignInForm />
              </div>
            </CardContent>
          </Card>
        </div>
      </Unauthenticated>

      <Authenticated>
        <MainLayout>
          <div className="space-y-8 w-full max-w-6xl mx-auto">
            <QuickCapture />
            <Separator className="my-8" />
            <div className="flex flex-col gap-10">
              <TasksWidget />
              <ProjectsWidget />
              <CalendarWidget />
              <NotesWidget />
            </div>
          </div>
        </MainLayout>
      </Authenticated>
    </div>
  );
}
