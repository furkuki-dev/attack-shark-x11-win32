import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	main: {
		build: {
			lib: {
				entry: 'src/main/index.ts',
			},
		},
		plugins: [externalizeDepsPlugin()],
	},
	preload: {
		build: {
			lib: {
				entry: 'src/preload/index.ts',
			},
		},
		plugins: [externalizeDepsPlugin()],
	},
	renderer: {
		resolve: {
			alias: {
				'@renderer': resolve('src/renderer/src'),
			},
		},
		plugins: [vue()],
	},
});
