"use client";

import { Ban, Clock, Shield, ShieldCheck, Users } from "lucide-react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStats } from "@/services";

export default function AdminStats() {
  const { data: stats } = useSWR("admin-stats", getStats);

  const items = [
    {
      label: "Total Users",
      value: stats?.total ?? 0,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Admins",
      value: stats?.admins ?? 0,
      icon: Shield,
      color: "text-violet-600",
    },
    {
      label: "Verified",
      value: stats?.verified ?? 0,
      icon: ShieldCheck,
      color: "text-green-600",
    },
    {
      label: "Pending",
      value: stats?.pending ?? 0,
      icon: Clock,
      color: "text-yellow-600",
    },
    {
      label: "Rejected",
      value: stats?.rejected ?? 0,
      icon: Ban,
      color: "text-red-500",
    },
    {
      label: "Banned",
      value: stats?.banned ?? 0,
      icon: Ban,
      color: "text-red-800",
    },
  ];

  return (
    <div>
      <h4 className="mb-3 font-semibold text-lg">Users Stats</h4>
      <div className="gap-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="py-4">
              <CardHeader className="px-4 pt-0 pb-2">
                <CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-0">
                <p className="font-bold text-2xl">{item.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
