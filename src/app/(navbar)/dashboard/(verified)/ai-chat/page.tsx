import AiChat from "@/components/dashboard/ai-chat/ai-chat";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function AiChatPage() {
	return (
		<DashboardLayout title="AI Assistant" className="pb-4">
			<AiChat />
		</DashboardLayout>
	);
}
