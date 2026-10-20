import RatingsList from "@/components/admin/ratings/ratings-list";
import AdminLayout from "@/components/layouts/admin-layout";

export default function RatingsPage() {
	return (
		<AdminLayout title="Ratings">
			<RatingsList />
		</AdminLayout>
	);
}
