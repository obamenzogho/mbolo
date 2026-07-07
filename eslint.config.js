const expoConfig = require('eslint-config-expo/flat')
module.exports = [
  ...expoConfig,
  { ignores: ['dist-ios/*', 'node_modules/*', 'functions/lib/*', '.expo/*'] },
]
