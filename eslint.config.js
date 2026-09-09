import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: ['apps/api/**/*.js', 'vite.config.js', 'playwright.config.js', 'e2e/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ['public/service-worker.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
    },
  },
  skipFormatting,
])
