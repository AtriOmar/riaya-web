import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	/** The base URL of the server (optional if you're using the same domain) */
	//   baseURL: "http://localhost:3000",
});

// Extended user type that includes additional fields from the server config
export type AppUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;
	// Additional fields
	displayName?: string | null;
	username?: string | null;
	accessId?: number | null;
	active?: number | null;
	type?: number | null;
};
