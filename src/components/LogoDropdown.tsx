// simple logo dropdown component that can be used to go to the landing page or sign out for the user

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.svg";
import { useAuth } from "@/hooks/use-auth";
import { Home, LogOut } from "lucide-react";
import { useNavigate } from "react-router";

export function LogoDropdown() {
  const { isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-[oklch(0.93_0.02_75)] shadow-[var(--shadow-clay-sm)] hover:bg-[oklch(0.89_0.03_75)]"
        >
          <img
            src={logo}
            alt="Logo"
            width={32}
            height={32}
            className="rounded-full"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="clay-card w-48 border-0 bg-card p-1.5"
      >
        <DropdownMenuItem
          onClick={handleGoHome}
          className="cursor-pointer rounded-xl font-bold"
        >
          <Home className="mr-2 h-4 w-4" />
          Landing Page
        </DropdownMenuItem>
        {isAuthenticated && (
          <>
            <DropdownMenuSeparator className="bg-border/70" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer rounded-xl font-bold text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
