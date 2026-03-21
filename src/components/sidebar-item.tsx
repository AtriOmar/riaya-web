"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SidebarItemData = {
  name: string;
  icon: ReactNode;
  path: string;
  strict?: boolean;
};

export default function SidebarItem({ item }: { item: SidebarItemData }) {
  const pathname = usePathname();
  const isActive =
    (item.strict && pathname === item.path) ||
    (!item.strict && pathname.startsWith(item.path));

  return (
    <Link
      href={item.path}
      className={cn(
        "items-center gap-3 grid grid-cols-[20px_1fr] mt-1 px-3 py-2.5 rounded-lg transition duration-200",
        isActive
          ? "bg-primary hover:bg-primary/90 text-primary-foreground"
          : "hover:bg-muted text-foreground",
      )}
    >
      {item.icon}
      <span>{item.name}</span>
    </Link>
  );
}

export type { SidebarItemData };
