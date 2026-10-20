"use client";

import { Copy, Loader2, Lock, Mail, Send, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-handling";
import type {
	GetApiSecretaries200InvitesItem,
	GetApiSecretaries200SecretariesItem,
} from "@/services/generated/api.schemas";
import {
	useDeleteApiSecretariesId,
	useDeleteApiSecretariesInvitesId,
	useGetApiSecretaries,
	usePostApiSecretariesInvites,
} from "@/services/generated/team/team";

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

async function copyLink(url: string) {
	try {
		await navigator.clipboard.writeText(url);
		toast.success("Link copied");
	} catch {
		toast.error("Couldn't copy. Select the link and copy it by hand.");
	}
}

function SecretaryRow({
	member,
	onChanged,
}: {
	member: GetApiSecretaries200SecretariesItem;
	onChanged: () => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const { trigger, isMutating } = useDeleteApiSecretariesId(String(member.id));

	async function remove() {
		try {
			await trigger();
			toast.success(`${member.name} no longer has access`);
			setConfirming(false);
			onChanged();
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not remove this secretary."));
		}
	}

	return (
		<li className="flex items-center gap-3 px-4 py-3">
			<Avatar className="size-9">
				<AvatarImage src={member.image ?? undefined} alt={member.name} />
				<AvatarFallback className="text-xs">
					{member.name.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">{member.name}</p>
				<p className="truncate text-muted-foreground text-xs">
					{member.email} · joined {formatDate(member.createdAt)}
				</p>
			</div>
			<Button
				size="sm"
				variant="ghost"
				className="gap-1.5 text-muted-foreground"
				onClick={() => setConfirming(true)}
			>
				<UserMinus className="size-4" />
				<span className="hidden sm:inline">Remove</span>
			</Button>

			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Remove {member.name}?</DialogTitle>
						<DialogDescription>
							They lose access to your practice right away. You can invite them
							again later.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirming(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={remove}
							disabled={isMutating}
						>
							{isMutating && <Loader2 className="size-4 animate-spin" />}
							Remove
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</li>
	);
}

function InviteRow({
	invite,
	onResend,
	resending,
	onChanged,
}: {
	invite: GetApiSecretaries200InvitesItem;
	onResend: (email: string) => void;
	resending: boolean;
	onChanged: () => void;
}) {
	const { trigger, isMutating } = useDeleteApiSecretariesInvitesId(
		String(invite.id),
	);

	async function cancel() {
		try {
			await trigger();
			onChanged();
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not cancel this invite."));
		}
	}

	return (
		<li className="flex items-center gap-3 px-4 py-3">
			<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Mail className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="truncate font-medium text-sm">{invite.email}</p>
					<Badge variant="secondary">Invited</Badge>
				</div>
				<p className="text-muted-foreground text-xs">
					Link expires {formatDate(invite.expiresAt)}
				</p>
			</div>
			<Button
				size="sm"
				variant="ghost"
				disabled={resending}
				onClick={() => onResend(invite.email)}
			>
				Resend
			</Button>
			<Button
				size="sm"
				variant="ghost"
				className="text-muted-foreground"
				disabled={isMutating}
				onClick={cancel}
				aria-label={`Cancel invite to ${invite.email}`}
			>
				<X className="size-4" />
			</Button>
		</li>
	);
}

/** Doctor's team: invite, list and remove secretaries (Pro). */
export default function TeamPanel() {
	const { data, isLoading, mutate } = useGetApiSecretaries();
	const { trigger: invite, isMutating: inviting } =
		usePostApiSecretariesInvites();
	const [email, setEmail] = useState("");
	/** Link to share by hand when the email couldn't be sent */
	const [manualLink, setManualLink] = useState<string | null>(null);

	async function sendInvite(to: string) {
		try {
			const res = await invite({ email: to });
			await mutate();
			setEmail("");
			if (res.emailSent) {
				toast.success(`Invite sent to ${res.invite.email}`, {
					action: {
						label: "Copy link",
						onClick: () => copyLink(res.inviteUrl),
					},
				});
			} else {
				setManualLink(res.inviteUrl);
			}
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not send the invite."));
		}
	}

	if (isLoading || !data) {
		return (
			<div className="flex justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const { secretaries, invites, canHaveSecretaries } = data;
	const used = secretaries.length + invites.length;
	const isFree = !canHaveSecretaries;
	const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

	return (
		<div className="max-w-2xl space-y-8">
			<section className="space-y-1">
				<h2 className="font-semibold text-lg">Secretaries</h2>
				<p className="text-muted-foreground text-sm">
					Secretaries manage appointments, patients, invoices and availability.
					They never see medical files, recordings, the AI assistant or billing.
				</p>
			</section>

			{isFree ? (
				<div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
					<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<Lock className="size-5" />
					</div>
					<div>
						<p className="font-medium">Secretary accounts are part of Pro</p>
						<p className="text-muted-foreground text-sm">
							Add as many secretaries as you need. They work in Riaya with you.
						</p>
					</div>
					<Button asChild>
						<Link href="/dashboard/subscription">Upgrade to Pro</Link>
					</Button>
				</div>
			) : (
				<>
					<form
						className="space-y-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (validEmail) void sendInvite(email.trim());
						}}
					>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Input
								type="email"
								placeholder="secretary@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								aria-label="Secretary's email"
							/>
							<Button
								type="submit"
								className="gap-2"
								disabled={!validEmail || inviting}
							>
								{inviting ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Send className="size-4" />
								)}
								Send invite
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							They'll get an email with a link to join.
						</p>
					</form>

					{used === 0 ? (
						<div className="rounded-xl border border-dashed py-10 text-center text-muted-foreground text-sm">
							No secretaries yet. Invite one above.
						</div>
					) : (
						<ul className="divide-y rounded-xl border">
							{secretaries.map((m) => (
								<SecretaryRow
									key={m.id}
									member={m}
									onChanged={() => mutate()}
								/>
							))}
							{invites.map((i) => (
								<InviteRow
									key={i.id}
									invite={i}
									onResend={sendInvite}
									resending={inviting}
									onChanged={() => mutate()}
								/>
							))}
						</ul>
					)}
				</>
			)}

			<Dialog
				open={manualLink != null}
				onOpenChange={(open) => !open && setManualLink(null)}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Share the invite link</DialogTitle>
						<DialogDescription>
							We couldn't send the email. Send this link to your secretary, for
							example on WhatsApp. It works for 7 days.
						</DialogDescription>
					</DialogHeader>
					<Input
						readOnly
						value={manualLink ?? ""}
						onFocus={(e) => e.target.select()}
					/>
					<DialogFooter>
						<Button
							className="gap-2"
							onClick={() => manualLink && copyLink(manualLink)}
						>
							<Copy className="size-4" />
							Copy link
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
