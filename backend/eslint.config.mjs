import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['dist/**', 'coverage/**', 'logs/**', 'node_modules/**', 'uploads/**'],
    },
    {
        files: ['src/**/*.ts'],
        extends: [eslint.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.node,
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'warn',
        },
    },
);
