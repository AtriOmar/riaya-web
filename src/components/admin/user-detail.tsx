"use client";

import { ShieldAlert, ShieldCheck, Stethoscope } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import UserInfoReadOnly from "@/components/dashboard/profile/user-info-readonly";
import { CubeLoader } from "@/components/loaders";
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
		<div className="space-y-8 max-w-2xl">
			<div className="gap-4 grid sm:grid-cols-2">
				<div>
					<p className="font-medium text-muted-foreground text-sm">Email</p>
					<p className="mt-1 px-3 py-1.5 rounded-sm border border-border/50 bg-muted text-sm font-medium">
						{user.email}
					</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-sm">Name</p>
					<p className="mt-1 px-3 py-1.5 rounded-sm border border-border/50 bg-muted text-sm font-medium">
						{user.displayName ?? user.name ?? "—"}
					</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-sm">Username</p>
					<p className="mt-1 px-3 py-1.5 rounded-sm border border-border/50 bg-muted text-sm font-medium">
						{user.username ?? "—"}
					</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-sm">
						Access Level
					</p>
					<p className="mt-1 px-3 py-1.5 rounded-sm border border-border/50 bg-muted text-sm font-medium flex items-center gap-1.5">
						{user.accessId === 5 ? (
							<>
								<ShieldAlert size={14} className="text-primary" /> Owner
							</>
						) : user.accessId === 3 ? (
							<>
								<ShieldCheck size={14} className="text-primary/70" /> Admin
							</>
						) : (
							<>
								<Stethoscope size={14} className="text-muted-foreground" />{" "}
								Doctor
							</>
						)}
					</p>
				</div>
			</div>

			{user.doctorProfile && (
				<div>
					<UserInfoReadOnly info={user.doctorProfile} title="Doctor Profile" />
				</div>
			)}

			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t">
				<div className="flex items-center gap-3">
					<Select
						value={accessId || String(user.accessId ?? 1)}
						onValueChange={setAccessId}
					>
						<SelectTrigger className="w-[160px] bg-background rounded-full">
							<SelectValue placeholder="Role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="1">Doctor</SelectItem>
							<SelectItem value="3">Admin</SelectItem>
							<SelectItem value="5">Owner</SelectItem>
						</SelectContent>
					</Select>
					<Button
						className="rounded-full shadow-md transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
						onClick={handleUpdateRole}
						disabled={saving}
					>
						Update Role
					</Button>
				</div>

				<Button
					variant="destructive"
					className="w-full sm:w-auto rounded-full shadow-sm transition-all hover:scale-105 active:scale-95"
					onClick={handleToggleBan}
					disabled={saving}
				>
					{user.active === 0 ? "Unban User" : "Ban User"}
				</Button>
			</div>
		</div>
	);
}
