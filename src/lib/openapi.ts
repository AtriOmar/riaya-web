import {
	extendZodWithOpenApi,
	OpenAPIRegistry,
	OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export function generateOpenApiDocument() {
	const generator = new OpenApiGeneratorV3(registry.definitions);

	return generator.generateDocument({
		openapi: "3.0.0",
		info: {
			version: "1.0.0",
			title: "Riaya API",
			description: "Internal and Public APIs for Riaya Healthcare Platform",
		},
		servers: [
			{
				url: "/api",
				description: "Next.js API Routes",
			},
		],
	});
}
