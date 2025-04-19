import * as React from "react";
import { Menu } from "lucide-react";
import { 
  Sheet, 
  SheetContent,
  SheetTrigger
} from "./sheet";
import { Button } from "./button";
import { cn } from "../../lib/utils";

interface MobileSidebarProps {
  children: React.ReactNode;
  className?: string;
  side?: "left" | "right" | "top" | "bottom";
}

export function MobileSidebar({ 
  children, 
  className,
  side = "left"
}: MobileSidebarProps) {
  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side={side} className={cn("p-0", className)}>
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
} 