"use client";
import { useConvexAuth, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./components/ui/button";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const signOut = useAction(api.auth.signOut);

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <Button variant="outline" onClick={() => void handleSignOut()}>
      Sign out
    </Button>
  );
}
