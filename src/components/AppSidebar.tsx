import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
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
  LogOut,
  Inbox,
  MoreVertical,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAction } from "convex/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Helper component for the sidebar header to properly handle collapsing
function CollapsibleHeader() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();

  return (
    <SidebarHeader className="flex items-center px-4 py-6">
      {isCollapsed ? (
        <div
          className="flex w-full justify-center cursor-pointer"
          onClick={() => void navigate("/")}
        >
          <img src="/logo.svg" alt="Zenify Logo" className="h-7 w-7" />
        </div>
      ) : (
        <div
          className="flex-1 transition-all duration-200 cursor-pointer"
          onClick={() => void navigate("/")}
        >
          <div className="flex items-center space-x-2">
            <img src="/logo.svg" alt="Zenify Logo" className="h-6 w-6" />
            <h1 className="text-lg font-medium tracking-tight whitespace-nowrap">
              Zenify
            </h1>
          </div>
        </div>
      )}
    </SidebarHeader>
  );
}

// Helper component for the sidebar footer to properly handle collapsing
function CollapsibleFooter() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const user = useQuery(api.auth.loggedInUser);
  const signOut = useAction(api.auth.signOut);

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
            <div
              className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2"} cursor-pointer p-2 rounded-md hover:bg-muted w-full`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.image} />
                <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
              </Avatar>

              {!isCollapsed && (
                <>
                  <div className="text-sm font-medium truncate transition-all duration-200">
                    {user?.name || "User"}
                  </div>
                  <MoreVertical className="h-4 w-4 text-muted-foreground ml-auto" />
                </>
              )}
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

// Navigation component that uses sidebar context
function NavItems({
  activeItem,
  navItems,
  onNavigate,
}: {
  activeItem: string;
  navItems: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    path: string;
  }>;
  onNavigate: (item: { id: string; path: string }) => void;
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu className={`${isCollapsed ? "px-1" : "px-2"}`}>
      {navItems.map((item) => {
        const isActive = activeItem === item.id;
        return (
          <SidebarMenuItem key={item.id} className="mb-1">
            <SidebarMenuButton
              tooltip={item.label}
              onClick={() => onNavigate(item)}
              className={`rounded-md flex ${
                isCollapsed ? "justify-center px-0" : "justify-start"
              } items-center py-2.5 transition-colors ${
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <div
                className={`flex items-center justify-center ${isCollapsed ? "mx-auto w-8 h-8" : "w-7 h-7"} rounded-md`}
              >
                <div className="h-4 w-4 flex items-center justify-center">
                  {item.icon}
                </div>
              </div>
              {!isCollapsed && (
                <span className="ml-3 text-sm font-medium">{item.label}</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar({
  activeItem,
  onNavigate,
}: {
  activeItem: string;
  onNavigate: (item: { id: string; path: string }) => void;
}) {
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

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <CollapsibleHeader />

      <SidebarContent>
        <SidebarGroup className="mt-1">
          <SidebarGroupLabel className="px-3 mb-2">
            Navigation
          </SidebarGroupLabel>
          <NavItems
            activeItem={activeItem}
            navItems={navItems}
            onNavigate={onNavigate}
          />
        </SidebarGroup>
      </SidebarContent>

      <CollapsibleFooter />

      <SidebarRail />
    </Sidebar>
  );
}
