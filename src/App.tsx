import { Outlet } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      <Toaster />
    </div>
  );
}
