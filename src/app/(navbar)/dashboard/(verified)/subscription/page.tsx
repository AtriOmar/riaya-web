import { Suspense } from "react";
import SubscriptionPanel from "@/components/dashboard/subscription/subscription-panel";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function SubscriptionPage() {
	return (
		<DashboardLayout title="Subscription">
			<Suspense fallback={null}>
				<SubscriptionPanel />
			</Suspense>
		</DashboardLayout>
	);
}
