import oxlint from 'eslint-plugin-oxlint'

// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(...oxlint.configs['flat/recommended'], {
  rules: {
    '@stylistic/comma-dangle': 'off',
    'vue/comma-dangle': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    '@stylistic/operator-linebreak': 'off',
    'vue/max-attributes-per-line': 'off',
    '@stylistic/member-delimiter-style': 'off',
    '@stylistic/arrow-parens': 'off',
    'vue/html-self-closing': 'off',
    'vue/no-deprecated-filter': 'off',
  },
})
