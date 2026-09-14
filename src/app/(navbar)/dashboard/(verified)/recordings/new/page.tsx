import { redirect } from "next/navigation";

export default function NewRecordingPage() {
	redirect("/dashboard/recordings?new=1");
}
