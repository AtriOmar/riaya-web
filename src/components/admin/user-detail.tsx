"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { CubeLoader } from "@/components/loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { adminUpdateUser, getUserById } from "@/services";

export default function UserDetail({ userId }: { userId: string }) {
	const {
		data: user,
		isLoading,
		mutate,
	} = useSWR(`admin-user-${userId}`, () => getUserById(userId));
	const [saving, setSaving] = useState(false);
	const [accessId, setAccessId] = useState<string>("");

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	if (!user) return <p className="text-muted-foreground">User not found.</p>;

	async function handleUpdateRole() {
		if (!accessId) return;
		setSaving(true);
		try {
			await adminUpdateUser(userId, { accessId: Number(accessId) });
			toast.success("User role updated");
			mutate();
		} catch {
			toast.error("Failed to update role");
		} finally {
			setSaving(false);
		}
	}

	async function handleToggleBan() {
		setSaving(true);
		try {
			await adminUpdateUser(userId, {
				status: user?.active === 0 ? "active" : "banned",
			});
			toast.success(user?.active === 0 ? "User unbanned" : "User banned");
			mutate();
		} catch {
			toast.error("Failed to update user status");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6 max-w-2xl">
			<div className="gap-4 grid sm:grid-cols-2 p-6 border rounded-xl bg-card">
				<div>
					<p className="text-muted-foreground text-sm">Email</p>
					<p className="font-medium">{user.email}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Name</p>
					<p className="font-medium">{user.displayName ?? user.name ?? "—"}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Username</p>
					<p className="font-medium">{user.username ?? "—"}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Access Level</p>
					<Badge variant="outline">{user.accessId ?? 1}</Badge>
				</div>
			</div>

			{user.doctorProfile && (
				<div className="p-6 border rounded-xl bg-card">
					<h4 className="mb-3 font-semibold">Doctor Profile</h4>
					<div className="gap-4 grid sm:grid-cols-2">
						<div>
							<p className="text-muted-foreground text-sm">First Name</p>
							<p className="font-medium">{user.doctorProfile.firstName}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-sm">Last Name</p>
							<p className="font-medium">{user.doctorProfile.lastName}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-sm">Cabinet Name</p>
							<p className="font-medium">
								{user.doctorProfile.cabinetName ?? "—"}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-sm">Speciality</p>
							<p className="font-medium">
								{user.doctorProfile.speciality?.name ?? "—"}
							</p>
						</div>
					</div>
				</div>
			)}

			<div className="space-y-4 p-6 border rounded-xl bg-card">
				<h4 className="font-semibold">Actions</h4>
				<div className="flex items-end gap-3">
					<div>
						<Label>Role</Label>
						<Select
							value={accessId || String(user.accessId ?? 1)}
							onValueChange={setAccessId}
						>
							<SelectTrigger className="w-[160px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">Doctor</SelectItem>
								<SelectItem value="3">Admin</SelectItem>
								<SelectItem value="5">Owner</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<Button onClick={handleUpdateRole} disabled={saving}>
						Update Role
					</Button>
				</div>
				<Button
					variant="destructive"
					onClick={handleToggleBan}
					disabled={saving}
				>
					{user.active === 0 ? "Unban User" : "Ban User"}
				</Button>
			</div>
		</div>
	);
}
