module.exports = {
	root: true,
	extends: ['eslint:recommended'],
	plugins: [
		'svelte3',
		'@typescript-eslint'
	],
	overrides: [{ files: ['*.svelte'], processor: 'svelte3/svelte3' }],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020
	},
	env: {
		browser: true,
		es2017: true,
		node: true
	},
	settings: {
		'svelte3/typescript': true,
	}
};
