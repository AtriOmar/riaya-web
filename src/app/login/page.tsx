import LoginForm from "@/components/auth/login-form";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string; email?: string }>;
}) {
	const { next, email } = await searchParams;
	return <LoginForm next={next ?? null} email={email ?? null} />;
}
