import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
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
