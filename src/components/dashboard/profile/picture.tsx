"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/contexts/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UpdatePictureModal from "./update-picture-modal";

export default function ProfilePicture() {
	const { user } = useAuth();
	const [showModal, setShowModal] = useState(false);

	return (
		<>
			<UpdatePictureModal
				open={showModal}
				onClose={() => setShowModal(false)}
			/>
			<button
				type="button"
				onClick={() => setShowModal(true)}
				className="group block relative w-fit mx-auto mt-4"
			>
				<Avatar className="w-[150px] h-[150px] ring-2 ring-primary shadow-lg">
					<AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
					<AvatarFallback className="text-3xl">
						{(user?.username ?? user?.name ?? "U").slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/15 transition" />
				<div className="right-0 bottom-0 absolute flex justify-center items-center size-8 rounded-full bg-primary group-hover:scale-110 transition">
					<Pencil className="size-4 text-primary-foreground" />
				</div>
			</button>
		</>
	);
}
