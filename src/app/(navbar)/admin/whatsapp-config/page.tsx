import WhatsappConfig from "@/components/whatsapp/whatsapp-config";

export default function AdminWhatsappConfigPage() {
	return (
		<div className="max-w-lg mx-auto px-4 py-10">
			<div className="mb-6">
				<h1 className="font-bold text-2xl">WhatsApp Configuration</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Link a WhatsApp account to send appointment confirmation messages.
				</p>
			</div>

			<WhatsappConfig userId="admin" />
		</div>
	);
}
