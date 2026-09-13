import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	output: "standalone",
	serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
