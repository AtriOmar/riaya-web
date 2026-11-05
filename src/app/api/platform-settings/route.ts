import type { NextRequest } from "next/server";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import {
	getPlatformSettings,
	savePlatformSettings,
} from "@/lib/platform-settings";
import { platformSettingsInputSchema } from "@/lib/platform-settings-schema";

// ─── GET /api/platform-settings ──────────────────────────────────────────────
// Admin-only: the timeouts in use now (the defaults until the first save).

export async function GET() {
	try {
		await requireAdmin();
		return json(await getPlatformSettings());
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/platform-settings ──────────────────────────────────────────────
// Admin-only: applies to requests created after the save. Jobs already queued
// keep the delay they were scheduled with.

export async function PUT(req: NextRequest) {
	try {
		const session = await requireAdmin();
		const parsed = platformSettingsInputSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		await savePlatformSettings(parsed.data, session.user.id);
		return json(await getPlatformSettings());
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/platform-settings",
	tags: ["Admin"],
	summary: "Get the platform settings (Admin)",
	responses: {
		200: {
			description: "Settings in use",
			content: {
				"application/json": { schema: platformSettingsInputSchema },
			},
		},
	},
});

registry.registerPath({
	method: "put",
	path: "/api/platform-settings",
	tags: ["Admin"],
	summary: "Update the platform settings (Admin)",
	request: {
		body: {
			content: { "application/json": { schema: platformSettingsInputSchema } },
		},
	},
	responses: {
		200: {
			description: "Saved settings",
			content: {
				"application/json": { schema: platformSettingsInputSchema },
			},
		},
	},
});
