import PlatformSettingsForm from "@/components/admin/platform-settings-form";
import AdminLayout from "@/components/layouts/admin-layout";

export default function AdminSettingsPage() {
	return (
		<AdminLayout title="Settings" className="max-w-2xl">
			<PlatformSettingsForm />
		</AdminLayout>
	);
}
