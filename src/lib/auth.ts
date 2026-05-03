import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

function defaultDoctorAvatarUrl() {
	// const base = (
	// 	process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
	// ).replace(/\/$/, "");
	const base = "https://riaya.omaratri.com";
	return `${base}/doctor-avatar.jpg`;
}

function userImageOrDefault(image: unknown) {
	if (typeof image === "string" && image.trim() !== "") {
		return undefined;
	}
	return defaultDoctorAvatarUrl();
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
	},
	databaseHooks: {
		user: {
			create: {
				before: async (data) => {
					const image = userImageOrDefault(data.image);
					if (image === undefined) return;
					return { data: { image } };
				},
			},
		},
	},
	user: {
		additionalFields: {
			displayName: { type: "string", required: false },
			username: { type: "string", required: false },
			accessId: { type: "number", required: false },
			active: { type: "number", required: false },
			type: { type: "number", required: false },
		},
	},
});
