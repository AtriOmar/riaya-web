"use client";

import { toast } from "sonner";
import { useAuth } from "@/components/contexts/auth-provider";
import ImageUploadModal from "@/components/dashboard/profile/image-upload-modal";
import { uploadBlobToR2 } from "@/lib/upload";
import { usePutApiUsersPicture } from "@/services/generated/users/users";

type Props = {
	open: boolean;
	onClose: () => void;
};

export default function UpdatePictureModal({ open, onClose }: Props) {
	const { trigger: updateProfilePicture } = usePutApiUsersPicture();
	const { refetch } = useAuth();

	async function handleSave(blob: Blob) {
		const cdnUrl = await uploadBlobToR2(
			blob,
			"profile.jpg",
			"profile-pictures",
		);
		await updateProfilePicture({ pictureUrl: cdnUrl });
		toast.success("Profile picture updated");
		refetch();
	}

	return (
		<ImageUploadModal
			open={open}
			onClose={onClose}
			title="Update Profile Picture"
			aspect={1}
			onSave={handleSave}
			errorMessage="Failed to update profile picture"
		/>
	);
}
