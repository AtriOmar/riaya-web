import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import WhatsappConfig from "@/components/whatsapp/whatsapp-config";
import { auth } from "@/lib/auth";

export default async function DoctorWhatsappConfigPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");

	return (
		<DashboardLayout title="WhatsApp Configuration">
			<p className="mb-6 text-muted-foreground text-sm">
				Link your WhatsApp account to send prescriptions and documents to
				patients directly from the dashboard.
			</p>
			<WhatsappConfig userId={session.user.id} />
		</DashboardLayout>
	);
}
