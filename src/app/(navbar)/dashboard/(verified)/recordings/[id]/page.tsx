import { redirect } from "next/navigation";

export default async function RecordingDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	redirect(`/dashboard/recordings?id=${id}`);
}
