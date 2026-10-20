"use client";

import { Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useAuth } from "@/components/contexts/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/error-handling";
import { authQuery } from "@/lib/safe-next";
import {
	useGetApiSecretaryInvitesToken,
	usePostApiSecretaryInvitesTokenAccept,
} from "@/services/generated/team/team";

/** Where an invited secretary lands from the email link. */
export default function JoinPracticePage() {
	const { token } = useParams<{ token: string }>();
	const router = useRouter();
	const { mutate } = useSWRConfig();
	const { user, isPending } = useAuth();
	const {
		data: invite,
		isLoading,
		error,
	} = useGetApiSecretaryInvitesToken(token);
	const { trigger: accept, isMutating } =
		usePostApiSecretaryInvitesTokenAccept(token);

	const next = `/join/${token}`;

	async function join() {
		try {
			await accept();
			// The dashboard reads the new role from /api/users/me
			await mutate(() => true, undefined, { revalidate: true });
			toast.success(`You've joined ${invite?.doctorName}'s practice`);
			router.push("/dashboard");
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not join the practice."));
		}
	}

	async function switchAccount() {
		await authClient.signOut();
		router.push(`/login${authQuery(next, invite?.email)}`);
		router.refresh();
	}

	let body: React.ReactNode;
	if (isLoading || isPending) {
		body = (
			<div className="flex justify-center py-6">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	} else if (error || !invite) {
		body = (
			<>
				<p className="text-muted-foreground text-sm">
					This invitation is invalid or has expired. Ask the doctor to send you
					a new one.
				</p>
				<Button asChild variant="outline" className="w-full">
					<Link href="/">Go to Riaya</Link>
				</Button>
			</>
		);
	} else if (!user) {
		body = (
			<>
				<p className="text-muted-foreground text-sm">
					Create an account with <strong>{invite.email}</strong>, or sign in if
					you already have one.
				</p>
				<div className="grid gap-2">
					<Button asChild className="w-full">
						<Link href={`/register${authQuery(next, invite.email)}`}>
							Create account
						</Link>
					</Button>
					<Button asChild variant="outline" className="w-full">
						<Link href={`/login${authQuery(next, invite.email)}`}>
							I already have an account
						</Link>
					</Button>
				</div>
			</>
		);
	} else if (user.email.toLowerCase() !== invite.email) {
		body = (
			<>
				<p className="text-muted-foreground text-sm">
					This invitation is for <strong>{invite.email}</strong>, but you're
					signed in as <strong>{user.email}</strong>.
				</p>
				<Button className="w-full" onClick={switchAccount}>
					Sign in as {invite.email}
				</Button>
			</>
		);
	} else {
		body = (
			<Button className="w-full" onClick={join} disabled={isMutating}>
				{isMutating && <Loader2 className="size-4 animate-spin" />}
				Join the practice
			</Button>
		);
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center bg-gradient-soft px-4 py-10">
			<div className="absolute top-4 right-4">
				<ThemeToggle />
			</div>
			<Card className="w-full max-w-md">
				<CardHeader className="items-center text-center">
					<div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<Users className="size-6" />
					</div>
					<CardTitle>
						{invite
							? `Join ${invite.doctorName}'s practice`
							: "Join a practice"}
					</CardTitle>
					{invite && (
						<CardDescription>
							{invite.cabinetName ? `${invite.cabinetName} · ` : ""}You'll
							manage appointments, patients and invoices as a secretary.
						</CardDescription>
					)}
				</CardHeader>
				<CardContent className="space-y-4">{body}</CardContent>
			</Card>
		</div>
	);
}
