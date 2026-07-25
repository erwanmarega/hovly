import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['.output/**', '.nuxt/**', 'dist/**', 'node_modules/**']
}).override('nuxt/typescript/rules', {
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn'
  }
}).override('nuxt/javascript', {
  rules: {
    'no-empty': ['error', { allowEmptyCatch: true }]
  }
})
