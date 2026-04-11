// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// npx vitest services/marketplace/__tests__/MarketplaceManager.spec.ts

import type { MarketplaceItem } from "@agenticflowx/types"

import { MarketplaceManager } from "../marketplace-manager"

// Mock axios
vi.mock("axios")

// Mock TelemetryService
vi.mock("../../../../../packages/telemetry/src/telemetry-service", () => ({
	TelemetryService: {
		instance: {
			captureMarketplaceItemInstalled: vi.fn(),
			captureMarketplaceItemRemoved: vi.fn(),
		},
	},
}))

// Mock vscode first
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
				name: "test",
				index: 0,
			},
		],
		openTextDocument: vi.fn(),
	},
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showTextDocument: vi.fn(),
	},
	Range: vi.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
	})),
}))

const mockContext = {
	subscriptions: [],
	workspaceState: {
		get: vi.fn(),
		update: vi.fn(),
	},
	globalState: {
		get: vi.fn(),
		update: vi.fn(),
	},
	extensionUri: { fsPath: "/test/extension" },
} as any

// Mock fs
vi.mock("fs/promises", () => ({
	readFile: vi.fn(),
	access: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
}))

// Mock yaml
vi.mock("yaml", () => ({
	parse: vi.fn(),
	stringify: vi.fn(),
}))

describe("MarketplaceManager", () => {
	let manager: MarketplaceManager

	beforeEach(() => {
		manager = new MarketplaceManager(mockContext)
		vi.clearAllMocks()
	})

	describe("filterItems", () => {
		it("should filter items by search term", () => {
			const items: MarketplaceItem[] = [
				{
					id: "test-mode",
					name: "Test Mode",
					description: "A test mode for testing",
					type: "mode",
					content: "# Test Mode\nThis is a test mode.",
				},
				{
					id: "other-mode",
					name: "Other Mode",
					description: "Another mode",
					type: "mode",
					content: "# Other Mode\nThis is another mode.",
				},
			]

			const filtered = manager.filterItems(items, { search: "test" })

			expect(filtered).toHaveLength(1)
			expect(filtered[0].name).toBe("Test Mode")
		})

		it("should filter items by type", () => {
			const items: MarketplaceItem[] = [
				{
					id: "test-mode",
					name: "Test Mode",
					description: "A test mode",
					type: "mode",
					content: "# Test Mode",
				},
				{
					id: "test-mcp",
					name: "Test MCP",
					description: "A test MCP",
					type: "mcp",
					url: "https://example.com/test-mcp",
					content: '{"command": "node", "args": ["server.js"]}',
				},
			]

			const filtered = manager.filterItems(items, { type: "mode" })

			expect(filtered).toHaveLength(1)
			expect(filtered[0].type).toBe("mode")
		})

		it("should return empty array when no items match", () => {
			const items: MarketplaceItem[] = [
				{
					id: "test-mode",
					name: "Test Mode",
					description: "A test mode",
					type: "mode",
					content: "# Test Mode",
				},
			]

			const filtered = manager.filterItems(items, { search: "nonexistent" })

			expect(filtered).toHaveLength(0)
		})
	})

	describe("getMarketplaceItems", () => {
		it("should return items from API", async () => {
			// Mock the config loader to return test data
			const mockItems: MarketplaceItem[] = [
				{
					id: "test-mode",
					name: "Test Mode",
					description: "A test mode",
					type: "mode",
					content: "# Test Mode",
				},
			]

			// Mock the loadAllItems method
			vi.spyOn(manager["configLoader"], "loadAllItems").mockResolvedValue(mockItems)

			const result = await manager.getMarketplaceItems()

			expect(result.marketplaceItems).toHaveLength(1)
			expect(result.marketplaceItems[0].name).toBe("Test Mode")
			expect(result.organizationMcps).toHaveLength(0)
		})

		it("should handle API errors gracefully", async () => {
			// Mock the config loader to throw an error
			vi.spyOn(manager["configLoader"], "loadAllItems").mockRejectedValue(new Error("API request failed"))

			const result = await manager.getMarketplaceItems()

			expect(result.marketplaceItems).toHaveLength(0)
			expect(result.organizationMcps).toHaveLength(0)
			expect(result.errors).toEqual(["API request failed"])
		})
	})

	describe("installMarketplaceItem", () => {
		it("should install a mode item", async () => {
			const item: MarketplaceItem = {
				id: "test-mode",
				name: "Test Mode",
				description: "A test mode",
				type: "mode",
				content: "# Test Mode\nThis is a test mode.",
			}

			// Mock the installer
			vi.spyOn(manager["installer"], "installItem").mockResolvedValue({
				filePath: "/test/path/.afxmodes",
				line: 5,
			})

			const result = await manager.installMarketplaceItem(item)

			expect(manager["installer"].installItem).toHaveBeenCalledWith(item, { target: "project" })
			expect(result).toBe("/test/path/.afxmodes")
		})

		it("should install an MCP item", async () => {
			const item: MarketplaceItem = {
				id: "test-mcp",
				name: "Test MCP",
				description: "A test MCP",
				type: "mcp",
				url: "https://example.com/test-mcp",
				content: '{"command": "node", "args": ["server.js"]}',
			}

			// Mock the installer
			vi.spyOn(manager["installer"], "installItem").mockResolvedValue({
				filePath: "/test/path/.afx/mcp.json",
				line: 3,
			})

			const result = await manager.installMarketplaceItem(item)

			expect(manager["installer"].installItem).toHaveBeenCalledWith(item, { target: "project" })
			expect(result).toBe("/test/path/.afx/mcp.json")
		})
	})

	describe("removeInstalledMarketplaceItem", () => {
		it("should remove a mode item", async () => {
			const item: MarketplaceItem = {
				id: "test-mode",
				name: "Test Mode",
				description: "A test mode",
				type: "mode",
				content: "# Test Mode",
			}

			// Mock the installer
			vi.spyOn(manager["installer"], "removeItem").mockResolvedValue()

			await manager.removeInstalledMarketplaceItem(item)

			expect(manager["installer"].removeItem).toHaveBeenCalledWith(item, { target: "project" })
		})

		it("should remove an MCP item", async () => {
			const item: MarketplaceItem = {
				id: "test-mcp",
				name: "Test MCP",
				description: "A test MCP",
				type: "mcp",
				url: "https://example.com/test-mcp",
				content: '{"command": "node", "args": ["server.js"]}',
			}

			// Mock the installer
			vi.spyOn(manager["installer"], "removeItem").mockResolvedValue()

			await manager.removeInstalledMarketplaceItem(item)

			expect(manager["installer"].removeItem).toHaveBeenCalledWith(item, { target: "project" })
		})
	})

	describe("cleanup", () => {
		it("should clear API cache", async () => {
			// Mock the clearCache method
			vi.spyOn(manager["configLoader"], "clearCache")

			await manager.cleanup()

			expect(manager["configLoader"].clearCache).toHaveBeenCalled()
		})
	})
})
