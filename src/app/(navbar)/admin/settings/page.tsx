import PlatformSettingsForm from "@/components/admin/platform-settings-form";
import AdminLayout from "@/components/layouts/admin-layout";

export default function AdminSettingsPage() {
	return (
		<AdminLayout title="Settings">
			<div className="pr-2 md:pr-10 pb-20 pl-2 max-w-2xl">
				<h3 className="mb-6 font-bold text-2xl">Settings</h3>
				<PlatformSettingsForm />
			</div>
		</AdminLayout>
	);
}
