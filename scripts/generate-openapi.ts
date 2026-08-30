import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { generateOpenApiDocument } from "../src/lib/openapi";

async function main() {
	console.log("Generating OpenAPI document...");

	// Find all route.ts files in the api directory
	const routeFiles = await fg("src/app/api/**/route.ts", {
		cwd: path.join(__dirname, ".."),
		absolute: true,
	});

	console.log(`Found ${routeFiles.length} API routes. Loading...`);

	// Import each file so that any registry.registerPath() calls are executed
	for (const file of routeFiles) {
		try {
			await import(file);
		} catch (e) {
			console.warn(`Warning: Failed to load ${file} -`, e);
		}
	}

	// Generate the document
	const document = generateOpenApiDocument();

	// Write to openapi.json
	const outputPath = path.join(__dirname, "..", "openapi.json");
	fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), "utf-8");

	console.log(`Successfully generated ${outputPath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
