import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	serverExternalPackages: ['@mastra/*', '@ai-sdk/*', 'zod'],
};

export default nextConfig;
