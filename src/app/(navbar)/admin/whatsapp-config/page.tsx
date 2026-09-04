import AdminLayout from "@/components/layouts/admin-layout";
import WhatsappConfig from "@/components/whatsapp/whatsapp-config";

export default function AdminWhatsappConfigPage() {
	return (
		<AdminLayout title="WhatsApp Configuration">
			<p className="mb-6 text-muted-foreground text-sm">
				Link a WhatsApp account to send appointment confirmation messages.
			</p>
			<WhatsappConfig userId="admin" />
		</AdminLayout>
	);
}
