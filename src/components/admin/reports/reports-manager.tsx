"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetApiCallReportsCount } from "@/services/generated/abuse/abuse";
import BlockedNumbers from "./blocked-numbers";
import ReportsList from "./reports-list";

export default function ReportsManager() {
	const { data: count } = useGetApiCallReportsCount();
	const open = count?.open ?? 0;

	return (
		<Tabs defaultValue="reports">
			<TabsList className="mb-4">
				<TabsTrigger value="reports">
					Reports
					{open > 0 && (
						<span className="ml-1.5 rounded-full bg-destructive px-1.5 font-semibold text-[10px] text-white leading-4">
							{open}
						</span>
					)}
				</TabsTrigger>
				<TabsTrigger value="blocked">Blocked numbers</TabsTrigger>
			</TabsList>
			<TabsContent value="reports">
				<ReportsList />
			</TabsContent>
			<TabsContent value="blocked">
				<BlockedNumbers />
			</TabsContent>
		</Tabs>
	);
}
