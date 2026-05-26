const REQUIRED_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
]

const OPTIONAL_VARS = [
  'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET',
  'EXPO_PUBLIC_SENTRY_DSN',
]

export interface EnvValidation {
  valid: boolean
  missing: string[]
  warnings: string[]
}

export function validateEnv(): EnvValidation {
  const missing: string[] = []
  const warnings: string[] = []

  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName]
    if (!value || value.trim() === '') {
      missing.push(varName)
    }
  }

  for (const varName of OPTIONAL_VARS) {
    const value = process.env[varName]
    if (!value || value.trim() === '') {
      warnings.push(`${varName} non configuré. Les uploads médias ne fonctionneront pas.`)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

export function logEnvStatus(): void {
  const result = validateEnv()
  if (!result.valid) {
    console.warn('[Mbolo] Variables d\'environnement manquantes:', result.missing.join(', '))
  }
  if (result.warnings.length > 0) {
    result.warnings.forEach(w => console.warn('[Mbolo]', w))
  }
}