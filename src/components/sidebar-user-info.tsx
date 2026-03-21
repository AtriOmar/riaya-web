"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type AppUser, authClient } from "@/lib/auth-client";

export default function SidebarUserInfo({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) {
  const { data: session } = authClient.useSession();
  const user = session?.user as AppUser | undefined;

  return (
    <>
      <div className="after:z-[-1] isolate after:absolute relative after:inset-0 h-[100px] bg-[url(/sidebar-background.jpg)] after:bg-primary/50 bg-cover bg-center">
        {isAdmin && (
          <div className="absolute flex items-center gap-1 px-2 py-1 rounded-br-lg bg-primary/90 shadow-md text-primary-foreground">
            <span className="font-medium text-xs">Admin</span>
          </div>
        )}
        <div className="bottom-0 left-1/2 absolute -translate-x-1/2 translate-y-1/3">
          <Avatar className="w-[72px] h-[72px] border-[3px] border-background">
            <AvatarImage
              src={user?.image ?? undefined}
              alt={user?.name ?? ""}
            />
            <AvatarFallback className="text-lg">
              {(user?.username ?? user?.name ?? "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
      <h4 className="mt-8 font-semibold text-lg text-center capitalize">
        {user?.username ?? user?.name}
      </h4>
    </>
  );
}
