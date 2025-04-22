import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";
import {
  CheckSquare,
  LayoutDashboard,
  Calendar,
  FileText,
  Settings,
  Bookmark,
  User,
  CalendarClock,
  ExternalLink,
  Check,
  Loader2,
  Inbox,
  LogOut,
  ChevronUp,
  MoreVertical,
} from "lucide-react";
import { SignOutButton } from "../SignOutButton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Separator } from "./ui/separator";
import { CalendarTimeline } from "./CalendarTimeline";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { useToast } from "../hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useConvexAuth, useAction } from "convex/react";

interface MainLayoutProps {
  children: React.ReactNode;
}

// Helper component for the sidebar header to properly handle collapsing
function CollapsibleHeader() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();

  return (
    <SidebarHeader className="flex items-center px-4 py-6">
      <div
        className={cn(
          "flex-1 transition-opacity duration-200 cursor-pointer",
          isCollapsed ? "opacity-0" : "opacity-100"
        )}
        onClick={() => void navigate("/")}
      >
        <h1 className="text-lg font-medium tracking-tight whitespace-nowrap">
          Life Planner
        </h1>
      </div>
    </SidebarHeader>
  );
}

// Helper component for the sidebar footer to properly handle collapsing
function CollapsibleFooter() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const user = useQuery(api.auth.loggedInUser);
  const signOut = useAction(api.auth.signOut);
  const navigate = useNavigate();

  const handleSignOut = () => {
    void (async () => {
      await signOut();
      window.location.reload();
    })();
  };

  const handleProfileClick = () => {
    // Navigate to profile page or open profile modal
    // console.log("Profile clicked");
  };

  const handleSettingsClick = () => {
    // Navigate to settings page or open settings modal
    // console.log("Settings clicked");
  };

  return (
    <SidebarFooter className="p-4">
      <div className="flex items-center justify-center w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted w-full justify-center">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.image} />
                <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
              </Avatar>

              <div
                className={cn(
                  "text-sm font-medium truncate transition-opacity duration-200",
                  isCollapsed ? "hidden" : "block"
                )}
              >
                {user?.name || "User"}
              </div>

              <MoreVertical
                className={cn(
                  "h-4 w-4 text-muted-foreground",
                  isCollapsed ? "hidden" : "block"
                )}
              />
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleProfileClick}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleSettingsClick}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => {
                void handleSignOut();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarFooter>
  );
}

// Responsive content that adjusts to both sidebars
function ResponsiveContent({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const isLeftSidebarCollapsed = state === "collapsed";

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
    error,
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
    if (isAuthorized) {
      disconnectFromGoogleCalendar();
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from Google Calendar",
      });
    } else {
      try {
        await connectToGoogleCalendar();
        toast({
          title: "Connected",
          description: "Successfully connected to Google Calendar",
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to connect to Google Calendar",
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
          <Separator orientation="vertical" className="h-4 mx-2" />
          <h2 className="text-lg font-medium tracking-tight">Life Planner</h2>
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

  // Navigation items for the sidebar
  const navItems = [
    {
      id: "inbox",
      label: "Inbox",
      icon: <Inbox className="h-4 w-4" />,
      path: "/",
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: <CheckSquare className="h-4 w-4" />,
      path: "/tasks",
    },
    {
      id: "projects",
      label: "Projects",
      icon: <LayoutDashboard className="h-4 w-4" />,
      path: "/projects",
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: <Calendar className="h-4 w-4" />,
      path: "/calendar",
    },
    {
      id: "notes",
      label: "Notes",
      icon: <FileText className="h-4 w-4" />,
      path: "/notes",
    },
    {
      id: "bookmarks",
      label: "Bookmarks",
      icon: <Bookmark className="h-4 w-4" />,
      path: "/bookmarks",
    },
  ];

  const handleNavigation = (item: (typeof navItems)[0]) => {
    setActiveItem(item.id);
    void navigate(item.path);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <Sidebar variant="sidebar" collapsible="icon">
          <CollapsibleHeader />

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeItem === item.id}
                      onClick={() => handleNavigation(item)}
                      tooltip={item.label}
                      className="rounded-md flex justify-center items-center py-3"
                    >
                      <div className="flex items-center justify-center w-5">
                        {React.cloneElement(item.icon, {
                          className: "h-5 w-5",
                        })}
                      </div>
                      <span className="ml-3 text-base">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <CollapsibleFooter />

          <SidebarRail />
        </Sidebar>

        {/* Main content with responsive behavior */}
        <ResponsiveContent>{children}</ResponsiveContent>
      </div>
    </SidebarProvider>
  );
}
