import RegisterForm from "@/components/auth/register-form";

export default async function RegisterPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string; email?: string }>;
}) {
	const { next, email } = await searchParams;
	return <RegisterForm next={next ?? null} email={email ?? null} />;
}
