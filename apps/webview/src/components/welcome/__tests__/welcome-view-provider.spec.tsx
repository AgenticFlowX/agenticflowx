// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// npx vitest src/components/welcome/__tests__/WelcomeViewProvider.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"

import * as ExtensionStateContext from "@src/context/ExtensionStateContext"
const { ExtensionStateContextProvider } = ExtensionStateContext

import WelcomeViewProvider from "../WelcomeViewProvider"
import { vscode } from "@src/utils/vscode"

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children, onClick }: any) => (
		<button onClick={onClick} data-testid="vscode-link">
			{children}
		</button>
	),
	VSCodeProgressRing: () => <div data-testid="progress-ring">Loading...</div>,
	VSCodeTextField: ({ value, onKeyUp, placeholder }: any) => (
		<input data-testid="text-field" type="text" value={value} onChange={onKeyUp} placeholder={placeholder} />
	),
	VSCodeRadioGroup: ({ children, value, _onChange }: any) => (
		<div data-testid="radio-group" data-value={value}>
			{children}
		</div>
	),
	VSCodeRadio: ({ children, value, onClick }: any) => (
		<div data-testid={`radio-${value}`} data-value={value} onClick={onClick}>
			{children}
		</div>
	),
}))

// Mock Button component
vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, variant }: any) => (
		<button onClick={onClick} data-testid={`button-${variant}`} data-variant={variant}>
			{children}
		</button>
	),
}))

// Mock ApiOptions
vi.mock("../../settings/ApiOptions", () => ({
	default: () => <div data-testid="api-options">API Options Component</div>,
}))

// Mock Tab components
vi.mock("../../common/Tab", () => ({
	Tab: ({ children }: any) => <div data-testid="tab">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
}))

// Mock AfxQuickStart (shared component used by WelcomeViewProvider)
vi.mock("../AfxQuickStart", () => ({
	default: ({ onSetUpProvider }: any) => (
		<div data-testid="afx-quick-start">
			{onSetUpProvider && (
				<button onClick={onSetUpProvider} data-testid="setup-provider-btn">
					Set Up Provider
				</button>
			)}
		</div>
	),
}))

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
	ArrowRight: () => <span data-testid="arrow-right-icon">→</span>,
	BadgeInfo: () => <span data-testid="badge-info-icon">ℹ</span>,
	Brain: () => <span data-testid="brain-icon">🧠</span>,
	TriangleAlert: () => <span data-testid="triangle-alert-icon">⚠</span>,
}))

// Mock vscode utility
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	Trans: ({ i18nKey, children }: any) => <span data-testid={`trans-${i18nKey}`}>{children || i18nKey}</span>,
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock buildDocLink
vi.mock("@/utils/doc-links", () => ({
	buildDocLink: (path: string, source: string) =>
		`https://agenticflowx.github.io/agenticflowx/${path}?utm_source=${source}`,
}))

// Mock validateApiConfiguration
vi.mock("@src/utils/validate", () => ({
	validateApiConfiguration: vi.fn(() => undefined),
}))

const renderWelcomeViewProvider = (extensionState = {}) => {
	const useExtensionStateMock = vi.spyOn(ExtensionStateContext, "useExtensionState")
	useExtensionStateMock.mockReturnValue({
		apiConfiguration: {},
		currentApiConfigName: "default",
		setApiConfiguration: vi.fn(),
		uriScheme: "vscode",
		...extensionState,
	} as any)

	render(
		<ExtensionStateContextProvider>
			<WelcomeViewProvider />
		</ExtensionStateContextProvider>,
	)

	return useExtensionStateMock
}

describe("WelcomeViewProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Landing Screen", () => {
		it("renders landing screen with hero and quick start", () => {
			renderWelcomeViewProvider()

			// Hero content (inlined)
			expect(screen.getByText("AgenticFlowX")).toBeInTheDocument()
			expect(screen.getByText("The spec-driven AI coding environment")).toBeInTheDocument()

			// Quick start (shared component)
			expect(screen.getByTestId("afx-quick-start")).toBeInTheDocument()

			// Footer
			expect(screen.getByText(/welcome:importSettings/)).toBeInTheDocument()
			expect(screen.getByText("Documentation")).toBeInTheDocument()

			// Should NOT show API options on landing
			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})

		it("navigates to provider setup when Set Up Provider is clicked", () => {
			renderWelcomeViewProvider()

			const setupBtn = screen.getByTestId("setup-provider-btn")
			fireEvent.click(setupBtn)

			// Should navigate to provider setup screen
			expect(screen.getByTestId("api-options")).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()
		})

		it("sends importSettings message when import button is clicked", () => {
			renderWelcomeViewProvider()

			const importButton = screen.getByText(/welcome:importSettings/)
			fireEvent.click(importButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "importSettings" })
		})

		it("sends openExternal message when Documentation is clicked", () => {
			renderWelcomeViewProvider()

			const docsButton = screen.getByText("Documentation")
			fireEvent.click(docsButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "openExternal",
				url: "https://agenticflowx.github.io/agenticflowx/",
			})
		})
	})

	describe("Provider Setup Screen", () => {
		const navigateToProviderSetup = () => {
			const setupBtn = screen.getByTestId("setup-provider-btn")
			fireEvent.click(setupBtn)
		}

		it("shows API options and heading", () => {
			renderWelcomeViewProvider()
			navigateToProviderSetup()

			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.useAnotherProviderDescription/)).toBeInTheDocument()
			expect(screen.getByTestId("api-options")).toBeInTheDocument()
			expect(screen.getByTestId("button-secondary")).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.goBack/)).toBeInTheDocument()
			expect(screen.getByTestId("button-primary")).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.finish/)).toBeInTheDocument()
		})

		it("returns to landing screen when Back is clicked", () => {
			renderWelcomeViewProvider()
			navigateToProviderSetup()

			expect(screen.getByTestId("api-options")).toBeInTheDocument()

			const backButton = screen.getByTestId("button-secondary")
			fireEvent.click(backButton)

			// Should be back on landing screen
			expect(screen.getByText("AgenticFlowX")).toBeInTheDocument()
			expect(screen.getByTestId("afx-quick-start")).toBeInTheDocument()
			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})

		it("saves configuration when Finish is clicked with valid config", () => {
			renderWelcomeViewProvider()
			navigateToProviderSetup()

			const finishButton = screen.getByTestId("button-primary")
			fireEvent.click(finishButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "upsertApiConfiguration",
				text: "default",
				apiConfiguration: {},
			})
		})
	})
})
