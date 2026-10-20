import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import UserDetail from "@/components/admin/user-detail";
import AdminLayout from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";

export default async function AdminUserPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return (
		<AdminLayout
			title={
				<span className="flex items-center gap-2">
					<Button variant="ghost" size="icon" asChild>
						<Link href="/admin/users" aria-label="Back to users">
							<ArrowLeft />
						</Link>
					</Button>
					User details
				</span>
			}
		>
			<UserDetail userId={id} />
		</AdminLayout>
	);
}
