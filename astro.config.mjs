// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE ?? 'https://collateral.frankencoin.com',
	output: 'server',

	server: {
		port: parseInt(process.env.PORT ?? '3000'),
		host: true,
		allowedHosts: ['collateral.frankencoin.com'],
	},

	vite: {
		plugins: [tailwindcss()],
		ssr: {
			// diff2html ships CSS + browser-oriented code; keep it out of the SSR bundle.
			noExternal: [],
		},
	},

	adapter: node({
		mode: 'standalone',
	}),
});
