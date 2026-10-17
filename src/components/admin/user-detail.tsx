"use client";

import { format } from "date-fns";
import {
	Ban,
	Copy,
	ExternalLink,
	FileText,
	ShieldAlert,
	ShieldCheck,
	Stethoscope,
	UserRoundX,
} from "lucide-react";
import Image from "next/image";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/contexts/auth-provider";
import CabinetLocationMap from "@/components/dashboard/profile/doctor-application/cabinet-location-map";
import { CubeLoader } from "@/components/loaders";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/error-handling";
import type {
	GetApiUsersId200,
	GetApiUsersId200DoctorProfile,
	PutApiUsersIdBody,
} from "@/services/generated/api.schemas";
import {
	useGetApiUsersId,
	usePutApiUsersId,
} from "@/services/generated/users/users";

type AccessId = NonNullable<PutApiUsersIdBody["accessId"]>;
type DoctorProfile = NonNullable<GetApiUsersId200DoctorProfile>;

const ROLES: Record<
	AccessId,
	{ label: string; description: string; icon: ReactNode }
> = {
	1: {
		label: "Doctor",
		description: "Uses the doctor dashboard",
		icon: <Stethoscope />,
	},
	3: {
		label: "Admin",
		description: "Manages doctors, users and calls",
		icon: <ShieldCheck />,
	},
	5: {
		label: "Owner",
		description: "Full platform access",
		icon: <ShieldAlert />,
	},
};

const DOCTOR_STATUS: Record<
	string,
	{ label: string; variant: "success" | "warning" | "destructive" | "outline" }
> = {
	verified: { label: "Verified", variant: "success" },
	pending: { label: "Pending review", variant: "warning" },
	rejected: { label: "Rejected", variant: "destructive" },
	banned: { label: "Banned", variant: "destructive" },
	none: { label: "No application", variant: "outline" },
};

function toAccessId(value: number | null): AccessId {
	return value === 3 || value === 5 ? value : 1;
}

function copy(text: string, label: string) {
	navigator.clipboard.writeText(text);
	toast.success(`${label} copied`);
}

export default function UserDetail({ userId }: { userId: string }) {
	const { data: user, isLoading, mutate } = useGetApiUsersId(userId);

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	if (!user) {
		return (
			<Card className="max-w-md">
				<CardContent className="flex flex-col items-center gap-2 py-10 text-center">
					<UserRoundX className="size-8 text-muted-foreground" />
					<p className="font-medium">User not found</p>
					<p className="text-muted-foreground text-sm">
						This account may have been deleted.
					</p>
				</CardContent>
			</Card>
		);
	}

	const profile = user.doctorProfile;

	return (
		<div className="space-y-6 max-w-6xl">
			<UserHeader user={user} />

			<div className="gap-6 grid lg:grid-cols-3 items-start">
				<div className="space-y-6 lg:col-span-2">
					<AccountCard user={user} />
					{profile ? (
						<>
							<ProfessionalCard profile={profile} />
							<PracticeCard profile={profile} />
							<DocumentsCard profile={profile} />
						</>
					) : (
						<Card>
							<CardContent className="py-8 text-center text-muted-foreground text-sm">
								This user has no doctor profile.
							</CardContent>
						</Card>
					)}
				</div>

				<div className="space-y-6 lg:sticky lg:top-6">
					<ManageCard user={user} onUpdated={(next) => mutate(next, false)} />
				</div>
			</div>
		</div>
	);
}

// ─── Header ─────────────────────────────────────────────────────────────────

function UserHeader({ user }: { user: GetApiUsersId200 }) {
	const name = user.displayName ?? user.name ?? user.email;
	const role = ROLES[toAccessId(user.accessId)];
	const status = user.doctorProfile
		? (DOCTOR_STATUS[user.doctorProfile.status ?? "none"] ?? DOCTOR_STATUS.none)
		: null;

	return (
		<Card>
			<CardContent className="flex sm:flex-row flex-col sm:items-center gap-4">
				<Avatar className="size-16 text-xl">
					<AvatarImage src={user.image ?? undefined} />
					<AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="font-semibold text-xl truncate">{name}</h2>
						<Badge variant={user.accessId === 1 ? "secondary" : "default"}>
							{role.icon}
							{role.label}
						</Badge>
						{status && <Badge variant={status.variant}>{status.label}</Badge>}
					</div>
					<p className="text-muted-foreground text-sm">
						{user.email} · Joined{" "}
						{format(new Date(user.createdAt), "MMM d, yyyy")}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// ─── Read-only sections ─────────────────────────────────────────────────────

function Field({
	label,
	value,
	copyable,
}: {
	label: string;
	value: string | null | undefined;
	copyable?: boolean;
}) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="flex items-center gap-1.5 mt-0.5 font-medium text-sm">
				<span className="truncate">{value || "—"}</span>
				{copyable && value && (
					<button
						type="button"
						onClick={() => copy(value, label)}
						className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
						aria-label={`Copy ${label}`}
					>
						<Copy className="size-3" />
					</button>
				)}
			</dd>
		</div>
	);
}

function FieldGrid({ children }: { children: ReactNode }) {
	return <dl className="gap-x-6 gap-y-4 grid sm:grid-cols-2">{children}</dl>;
}

function AccountCard({ user }: { user: GetApiUsersId200 }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Account</CardTitle>
			</CardHeader>
			<CardContent>
				<FieldGrid>
					<Field label="Email" value={user.email} copyable />
					<Field label="Name" value={user.displayName ?? user.name} />
					<Field label="Username" value={user.username} />
					<Field label="User ID" value={user.id} copyable />
				</FieldGrid>
			</CardContent>
		</Card>
	);
}

function localizedName(
	item: {
		enName: string | null;
		frName: string | null;
		arName: string | null;
	} | null,
) {
	return item?.enName ?? item?.frName ?? item?.arName ?? null;
}

function ProfessionalCard({ profile }: { profile: DoctorProfile }) {
	const fullName = [profile.firstName, profile.lastName]
		.filter(Boolean)
		.join(" ");
	return (
		<Card>
			<CardHeader>
				<CardTitle>Professional</CardTitle>
			</CardHeader>
			<CardContent>
				<FieldGrid>
					<Field label="Full name" value={fullName} />
					<Field label="Speciality" value={localizedName(profile.speciality)} />
					<Field
						label="Medical council number"
						value={profile.medicalCouncilNumber}
						copyable
					/>
					<Field label="CIN" value={profile.cin} copyable />
					<Field label="TIN" value={profile.tin} copyable />
				</FieldGrid>
			</CardContent>
		</Card>
	);
}

function PracticeCard({ profile }: { profile: DoctorProfile }) {
	const hasLocation =
		profile.cabinetLatitude != null && profile.cabinetLongitude != null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>Practice</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<FieldGrid>
					<Field label="Cabinet" value={profile.cabinetName} />
					<Field label="City" value={localizedName(profile.cabinetCity)} />
					<div className="sm:col-span-2">
						<Field label="Address" value={profile.address} />
					</div>
				</FieldGrid>
				{hasLocation && (
					<div className="relative z-0 overflow-hidden rounded-lg border">
						<CabinetLocationMap
							className="h-[260px]"
							center={{
								lat: profile.cabinetLatitude as number,
								lng: profile.cabinetLongitude as number,
							}}
							marker={{
								lat: profile.cabinetLatitude as number,
								lng: profile.cabinetLongitude as number,
							}}
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function DocumentsCard({ profile }: { profile: DoctorProfile }) {
	const documents = [
		{ label: "CIN front", url: profile.cinRecto },
		{ label: "CIN back", url: profile.cinVerso },
		{
			label: "Medical council certificate",
			url: profile.medicalCouncilCertificate,
		},
	].filter((doc): doc is { label: string; url: string } => Boolean(doc.url));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Documents</CardTitle>
				<CardDescription>
					Click a document to open it full size.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{documents.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No documents uploaded.
					</p>
				) : (
					<div className="gap-4 grid grid-cols-2 sm:grid-cols-3">
						{documents.map((doc) => (
							<a
								key={doc.label}
								href={doc.url}
								target="_blank"
								rel="noopener noreferrer"
								className="group space-y-2"
							>
								<div className="relative flex justify-center items-center bg-muted border rounded-lg aspect-[14/9] overflow-hidden group-hover:ring-2 group-hover:ring-primary/40 transition">
									{doc.url.toLowerCase().endsWith(".pdf") ? (
										<FileText className="size-8 text-muted-foreground" />
									) : (
										<Image
											unoptimized
											src={doc.url}
											alt={doc.label}
											fill
											className="object-cover"
										/>
									)}
								</div>
								<p className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground text-xs transition-colors">
									{doc.label}
									<ExternalLink className="size-3" />
								</p>
							</a>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ─── Manage ─────────────────────────────────────────────────────────────────

function ManageCard({
	user,
	onUpdated,
}: {
	user: GetApiUsersId200;
	onUpdated: (next: GetApiUsersId200) => void;
}) {
	const { user: me } = useAuth();
	const { trigger: updateUser, isMutating } = usePutApiUsersId(user.id);
	const currentRole = toAccessId(user.accessId);
	const [role, setRole] = useState<AccessId>(currentRole);
	const [banOpen, setBanOpen] = useState(false);

	const isSelf = me?.id === user.id;
	const profile = user.doctorProfile;
	const isBanned = profile?.status === "banned";

	async function save(body: PutApiUsersIdBody, success: string) {
		try {
			const next = await updateUser(body);
			onUpdated(next);
			toast.success(success);
			return true;
		} catch (e) {
			toast.error(getErrorMessage(e));
			return false;
		}
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Role</CardTitle>
					<CardDescription>
						{isSelf
							? "You can't change your own role."
							: "Controls which part of Riaya this user can open."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<Select
						value={String(role)}
						onValueChange={(v) => setRole(Number(v) as AccessId)}
						disabled={isSelf || isMutating}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(ROLES).map(([key, option]) => (
								<SelectItem key={key} value={key}>
									{option.icon}
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						{ROLES[role].description}
					</p>
					{role !== currentRole && (
						<div className="flex gap-2">
							<Button
								className="flex-1"
								size="sm"
								disabled={isMutating}
								onClick={() =>
									save(
										{ accessId: role },
										`Role changed to ${ROLES[role].label}`,
									)
								}
							>
								Save role
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={isMutating}
								onClick={() => setRole(currentRole)}
							>
								Cancel
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{profile && !isSelf && (
				<Card className={isBanned ? "border-destructive/40" : undefined}>
					<CardHeader>
						<CardTitle>Doctor access</CardTitle>
						<CardDescription>
							{isBanned
								? "This doctor is banned and can't use the dashboard."
								: "Banning blocks this doctor from the dashboard and from bookings."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isBanned ? (
							<Button
								variant="outline"
								className="w-full"
								disabled={isMutating}
								onClick={() => save({ banned: false }, "Doctor unbanned")}
							>
								Unban doctor
							</Button>
						) : (
							<Button
								variant="destructive"
								className="w-full"
								disabled={isMutating}
								onClick={() => setBanOpen(true)}
							>
								<Ban />
								Ban doctor
							</Button>
						)}
					</CardContent>
				</Card>
			)}

			<Dialog open={banOpen} onOpenChange={setBanOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Ban this doctor?</DialogTitle>
						<DialogDescription>
							{user.displayName ?? user.name ?? user.email} will lose access to
							the doctor dashboard right away. You can unban them later.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							variant="destructive"
							disabled={isMutating}
							onClick={async () => {
								if (await save({ banned: true }, "Doctor banned")) {
									setBanOpen(false);
								}
							}}
						>
							Ban doctor
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
