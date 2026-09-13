import InvoicesList from "@/components/dashboard/invoices/invoices-list";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function InvoicesPage() {
	return (
		<DashboardLayout title="Invoices">
			<InvoicesList />
		</DashboardLayout>
	);
}
