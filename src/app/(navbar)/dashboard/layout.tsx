import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");
  if (session.user.accessId && session.user.accessId >= 3) redirect("/admin");

  return (
    <>
      <Sidebar />
      <div className="mt-[70px] md:ml-[260px]">{children}</div>
    </>
  );
}
