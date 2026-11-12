/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,ts,js}'],
	theme: {
		extend: {
			colors: {
				// Dynamic theme colors: RGB channels come from CSS variables so /20 etc. work.
				'shark-primary': 'rgb(var(--shark-primary-rgb) / <alpha-value>)',
				'shark-accent': 'rgb(var(--shark-accent-rgb) / <alpha-value>)',
				'shark-dark': 'rgb(var(--shark-dark-rgb) / <alpha-value>)',
				// Static semantic colors
				'shark-primary-light': '#60a5fa',
				'shark-primary-dark': '#2563eb',
				'shark-accent-light': '#4ade80',
				'shark-accent-dark': '#16a34a',
				'shark-surface-1': '#1e293b',
				'shark-surface-2': '#334155',
				'shark-surface-3': '#475569',
				'shark-text': '#f8fafc',
				'shark-text-secondary': '#94a3b8',
				'shark-text-muted': '#64748b',
				'shark-error': '#ef4444',
				'shark-error-light': '#fca5a5',
				'shark-warning': '#f59e0b',
				'shark-warning-light': '#fcd34d',
				'shark-success': '#22c55e',
				'shark-success-light': '#4ade80',
				'shark-info': '#3b82f6',
				'shark-info-light': '#60a5fa',
			},
		},
	},
	plugins: [],
};
