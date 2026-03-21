import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/admin-sidebar";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");
  if (!session.user.accessId || session.user.accessId < 3) notFound();

  return (
    <>
      <AdminSidebar />
      <div className="mt-[70px] md:ml-[260px]">{children}</div>
    </>
  );
}
