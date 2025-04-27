import React, { useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "./ui/sidebar";
import {
  CalendarClock,
  ExternalLink,
  Check,
  Loader2,
  Calendar,
} from "lucide-react";
import { CalendarTimeline } from "./CalendarTimeline";
import { Button } from "./ui/button";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { useToast } from "../hooks/use-toast";
import { AppSidebar } from "./AppSidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

// Responsive content that adjusts to both sidebars
function ResponsiveContent({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const isLeftSidebarCollapsed = state === "collapsed";
  const connectionTestRunning = useRef(false);

  // Load initial timeline state from localStorage or default to true (visible)
  const [showTimeline, setShowTimeline] = React.useState(() => {
    try {
      const savedState = localStorage.getItem("timeline_visible");
      return savedState === null ? true : savedState === "true";
    } catch (error) {
      console.error("Error loading timeline state:", error);
      return true; // Default to visible if there's an error
    }
  });

  const { toast } = useToast();
  const {
    isLoading,
    isAuthorized,
    connectToGoogleCalendar,
    disconnectFromGoogleCalendar,
  } = useGoogleCalendar();

  // Toggle timeline visibility and save state
  const toggleTimeline = () => {
    const newState = !showTimeline;
    setShowTimeline(newState);
    try {
      localStorage.setItem("timeline_visible", String(newState));
    } catch (error) {
      console.error("Error saving timeline state:", error);
    }
  };

  // Handle Google Calendar connection
  const handleGoogleCalendarConnect = async () => {
    if (isLoading) return; // Prevent multiple clicks while loading

    if (isAuthorized) {
      disconnectFromGoogleCalendar();
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from Google Calendar",
      });
    } else {
      try {
        // Only run test if it's not already running
        if (!connectionTestRunning.current) {
          connectionTestRunning.current = true;
          try {
            const testEndpoint =
              "https://clean-armadillo-885.convex.cloud/api/debug";
            console.log("Testing Convex connection before auth...");
            const testResponse = await fetch(testEndpoint);
            console.log("Convex test response status:", testResponse.status);
            // Just get the text response instead of trying to parse JSON
            const responseText = await testResponse.text();
            console.log("Convex response text:", responseText);
          } catch (testErr) {
            console.error("Convex connection test failed:", testErr);
          } finally {
            connectionTestRunning.current = false;
          }
        }

        // Now try to connect to Google Calendar
        await connectToGoogleCalendar();
        toast({
          title: "Connected",
          description: "Successfully connected to Google Calendar",
        });
      } catch (err: any) {
        console.error("Google Calendar connection error:", err);
        toast({
          title: "Connection Error",
          description: err.message || "Failed to connect to Google Calendar",
          variant: "destructive",
        });
      }
    }
  };

  // Calculate padding classes based on sidebar states
  const getMainContentClasses = () => {
    let classes = "flex-1 py-6 overflow-auto transition-all duration-300 ";

    // Horizontal padding based on both sidebars
    if (isLeftSidebarCollapsed && !showTimeline) {
      classes += "px-8 md:px-10 "; // More space when both are collapsed/hidden
    } else if (!isLeftSidebarCollapsed && !showTimeline) {
      classes += "px-6 md:px-8 "; // Normal padding when only left is expanded
    } else if (isLeftSidebarCollapsed && showTimeline) {
      classes += "px-4 md:px-6 "; // Less padding when timeline is showing but left is collapsed
    } else {
      classes += "px-4 "; // Minimal padding when both sidebars are showing
    }

    return classes;
  };

  return (
    <SidebarInset className="min-h-screen max-h-screen overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 backdrop-blur-sm bg-background/90 border-b">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          {/* <Separator orientation="vertical" className="h-4 mx-2" />
          <div className="flex items-center space-x-2">
            <img src="/logo.svg" alt="Zenify Logo" className="h-5 w-5" />
            <h2 className="text-lg font-medium tracking-tight">Zenify</h2>
          </div> */}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isAuthorized ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-1"
            onClick={() => {
              void handleGoogleCalendarConnect();
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAuthorized ? (
              <Check className="h-4 w-4" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            <span>
              {isAuthorized
                ? "Google Calendar Connected"
                : "Connect Google Calendar"}
            </span>
            {!isAuthorized && <ExternalLink className="h-3 w-3 ml-1" />}
          </Button>

          {/* Debug button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!connectionTestRunning.current) {
                connectionTestRunning.current = true;
                const testEndpoint =
                  "https://clean-armadillo-885.convex.cloud/api/debug";
                console.log("Testing Convex connection...");
                fetch(testEndpoint)
                  .then((response) => {
                    console.log(
                      "Convex test response status:",
                      response.status
                    );
                    return response.text();
                  })
                  .then((text) => {
                    console.log("Convex test response:", text);
                    toast({
                      title: "Connection Test",
                      description: "Check console for details",
                    });
                  })
                  .catch((err) => {
                    console.error("Convex test error:", err);
                    toast({
                      title: "Connection Error",
                      description: err.message,
                      variant: "destructive",
                    });
                  })
                  .finally(() => {
                    connectionTestRunning.current = false;
                  });
              }
            }}
          >
            Test Connection
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTimeline}
            className={`flex items-center gap-1 ${showTimeline ? "bg-muted" : ""}`}
          >
            <CalendarClock className="h-4 w-4" />
            <span>Timeline</span>
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)] relative w-full max-w-full overflow-x-hidden">
        <main
          className={`${getMainContentClasses()} ${showTimeline ? "w-[calc(100%-384px)]" : "w-full"} max-w-full`}
        >
          <div className="w-full max-w-full">{children}</div>
        </main>

        {/* Calendar Timeline */}
        {showTimeline && (
          <div className="h-full w-96 border-l border-border flex-shrink-0">
            <CalendarTimeline onClose={toggleTimeline} />
          </div>
        )}
      </div>
    </SidebarInset>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeItem, setActiveItem] = React.useState("inbox"); // Default value

  // Update activeItem when location changes
  React.useEffect(() => {
    // Set active item based on current route
    const path = location.pathname;
    if (path === "/") setActiveItem("inbox");
    else if (path.includes("/tasks")) setActiveItem("tasks");
    else if (path.includes("/projects")) setActiveItem("projects");
    else if (path.includes("/calendar")) setActiveItem("calendar");
    else if (path.includes("/notes")) setActiveItem("notes");
    else if (path.includes("/bookmarks")) setActiveItem("bookmarks");
    else setActiveItem("tasks");
  }, [location.pathname]);

  const handleNavigation = (item: { id: string; path: string }) => {
    setActiveItem(item.id);
    void navigate(item.path);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Use the AppSidebar component */}
        <AppSidebar activeItem={activeItem} onNavigate={handleNavigation} />

        {/* Main content with responsive behavior */}
        <ResponsiveContent>{children}</ResponsiveContent>
      </div>
    </SidebarProvider>
  );
}
