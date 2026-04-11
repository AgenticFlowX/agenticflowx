// Re-export i18next.t() — identical to apps/vscode/i18n/index.ts t() function
import i18next from "i18next"

export function t(key: string, options?: Record<string, any>): string {
	return i18next.t(key, options)
}
