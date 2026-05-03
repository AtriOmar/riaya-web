import type { Patient } from "@/services/types";

export function PatientDetails({ patient }: { patient: Patient }) {
	return (
		<div className="gap-4 grid sm:grid-cols-3 max-w-xl p-4 border rounded-xl bg-card">
			<div>
				<p className="text-muted-foreground text-sm">CIN</p>
				<p className="font-medium">{patient.cin}</p>
			</div>
			<div>
				<p className="text-muted-foreground text-sm">Full Name</p>
				<p className="font-medium">
					{patient.firstName} {patient.lastName}
				</p>
			</div>
			<div>
				<p className="text-muted-foreground text-sm">Date of Birth</p>
				<p className="font-medium">
					{patient.dateOfBirth
						? new Date(patient.dateOfBirth).toLocaleDateString("en-GB")
						: "—"}
				</p>
			</div>
			<div>
				<p className="text-muted-foreground text-sm">Gender</p>
				<p className="font-medium capitalize">{patient.gender ?? "—"}</p>
			</div>
			{patient.phoneNumber && (
				<div>
					<p className="text-muted-foreground text-sm">Phone</p>
					<p className="font-medium">{patient.phoneNumber}</p>
				</div>
			)}
			{patient.address && (
				<div>
					<p className="text-muted-foreground text-sm">Address</p>
					<p className="font-medium">{patient.address}</p>
				</div>
			)}
		</div>
	);
}
