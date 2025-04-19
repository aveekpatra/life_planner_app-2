import { Authenticated, Unauthenticated } from "convex/react";
import { MainLayout } from "../components/MainLayout";
import { Navigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export default function BookmarksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Unauthenticated>
        <Navigate to="/" replace />
      </Unauthenticated>

      <Authenticated>
        <MainLayout>
          <div className="space-y-8 w-full max-w-6xl mx-auto">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Bookmarks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your bookmarks will appear here.
                </p>
              </CardContent>
            </Card>
          </div>
        </MainLayout>
      </Authenticated>
    </div>
  );
}
