import { defineConfig } from "orval";

export default defineConfig({
	riaya: {
		input: "./openapi.json",
		output: {
			mode: "tags-split",
			target: "./src/services/generated/api.ts",
			client: "swr",
			httpClient: "axios",
			override: {
				mutator: {
					path: "./src/services/api.ts",
					name: "customInstance",
				},
			},
		},
	},
});
