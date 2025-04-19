import React from "react";
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
} from "lucide-react";
import { SignOutButton } from "../SignOutButton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Separator } from "./ui/separator";
import { CalendarTimeline } from "./CalendarTimeline";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

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
        onClick={() => navigate("/")}
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

  return (
    <SidebarFooter className="p-4">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-2",
            isCollapsed ? "w-0 overflow-hidden" : "w-auto"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user?.pictureURL} />
            <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div
            className="text-sm font-medium truncate transition-opacity duration-200"
            style={{ opacity: isCollapsed ? 0 : 1 }}
          >
            {user?.name || "User"}
          </div>
        </div>
        <SignOutButton
          className="h-8 w-8 shrink-0"
          variant="ghost"
          size="icon"
        />
      </div>
    </SidebarFooter>
  );
}

// Responsive content that adjusts to both sidebars
function ResponsiveContent({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const isLeftSidebarCollapsed = state === "collapsed";
  const [showTimeline, setShowTimeline] = React.useState(false);

  // Toggle timeline visibility
  const toggleTimeline = () => {
    setShowTimeline(!showTimeline);
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
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Calendar className="h-4 w-4" />
            <span>Connect Google Calendar</span>
            <ExternalLink className="h-3 w-3 ml-1" />
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
  const [activeItem, setActiveItem] = React.useState(() => {
    // Set active item based on current route
    const path = location.pathname;
    if (path.includes("/tasks")) return "tasks";
    if (path.includes("/projects")) return "projects";
    if (path.includes("/calendar")) return "calendar";
    if (path.includes("/notes")) return "notes";
    if (path.includes("/bookmarks")) return "bookmarks";
    return "tasks";
  });

  // Navigation items for the sidebar
  const navItems = [
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
    navigate(item.path);
  };

  return (
    <SidebarProvider defaultOpen={false}>
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
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Preferences">
                    <Settings className="h-4 w-4" />
                    <span>Preferences</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Profile">
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
