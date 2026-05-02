import LiveCalls from "@/components/admin/calls/live-calls";

export default function CallsPage() {
	return (
		<div className="pr-2 md:pr-10 pb-20 pl-2">
			<h3 className="mb-4 font-bold text-2xl">Calls</h3>
			<LiveCalls />
		</div>
	);
}
