// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiHandlerOptions } from "@agenticflowx/types"

/**
 * Minimal handler interface that all providers must implement.
 * The full ApiHandler (with createMessage, getModel, countTokens) extends this
 * in the extension — this is just the factory contract.
 */
export interface ApiHandlerLike {
	getModel(): { id: string; info: unknown }
}

/**
 * Factory that creates an API handler for a specific provider.
 */
export interface ProviderFactory {
	create(options: ApiHandlerOptions): ApiHandlerLike
}

/**
 * Registration entry for a provider in the registry.
 */
export interface ProviderRegistration {
	name: string
	factory: ProviderFactory
	sdkDependency?: string
}

/**
 * Synchronous provider registry. Replaces the monolithic buildApiHandler() switch-case
 * with a Map lookup. All provider SDKs are bundled by esbuild — nothing to lazy-load.
 *
 * @see docs/research/res-monorepo-plugin-migration.md [D11]
 */
export class ProviderRegistry {
	private providers = new Map<string, ProviderRegistration>()

	/** Register a provider (called at module initialization). */
	register(registration: ProviderRegistration): void {
		this.providers.set(registration.name, registration)
	}

	/** Sync resolve — replaces the buildApiHandler switch-case. */
	resolve(name: string): ProviderFactory {
		const reg = this.providers.get(name)
		if (!reg) throw new Error(`Unknown provider: ${name}`)
		return reg.factory
	}

	has(name: string): boolean {
		return this.providers.has(name)
	}

	listRegistered(): string[] {
		return [...this.providers.keys()]
	}
}
