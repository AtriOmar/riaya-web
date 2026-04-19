import VerifiedDoctorGate from "@/components/layouts/verified-doctor-gate";

export default function VerifiedDoctorSectionLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <VerifiedDoctorGate>{children}</VerifiedDoctorGate>;
}
