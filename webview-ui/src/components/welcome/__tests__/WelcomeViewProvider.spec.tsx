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
		<button onClick={onClick} data-testid={`button-${variant}`}>
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

// Mock AFXHero
vi.mock("../AfxHero", () => ({
	default: () => <div data-testid="afx-hero">AFX Hero</div>,
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
vi.mock("@/utils/docLinks", () => ({
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
		it("renders landing screen by default", () => {
			renderWelcomeViewProvider()

			// Should show AfxHero
			expect(screen.getByTestId("afx-hero")).toBeInTheDocument()

			// Should show "Get Started" button
			expect(screen.getByTestId("button-primary")).toBeInTheDocument()
			expect(screen.getByText(/welcome:landing.getStarted/)).toBeInTheDocument()

			// Should show "Import Settings" button
			expect(screen.getByText(/welcome:importSettings/)).toBeInTheDocument()

			// Should NOT show API options on landing
			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})

		it("navigates to provider setup when 'Get Started' is clicked", () => {
			renderWelcomeViewProvider()

			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should navigate to provider setup screen (no cloud auth)
			expect(screen.getByTestId("api-options")).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()

			// Should NOT trigger any cloud sign-in
			expect(vscode.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "afxCloudSignIn" }))
		})

		it("sends importSettings message when import button is clicked", () => {
			renderWelcomeViewProvider()

			const importButton = screen.getByText(/welcome:importSettings/)
			fireEvent.click(importButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "importSettings" })
		})
	})

	describe("Provider Setup Screen", () => {
		const navigateToProviderSetup = () => {
			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)
		}

		it("shows API options and heading", () => {
			renderWelcomeViewProvider()
			navigateToProviderSetup()

			// Should show the heading
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()

			// Should show provider description
			expect(screen.getByText(/welcome:providerSignup.useAnotherProviderDescription/)).toBeInTheDocument()

			// Should show API options
			expect(screen.getByTestId("api-options")).toBeInTheDocument()

			// Should show Back and Finish buttons
			expect(screen.getByTestId("button-secondary")).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.goBack/)).toBeInTheDocument()
			expect(screen.getByTestId("button-primary")).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.finish/)).toBeInTheDocument()
		})

		it("returns to landing screen when Back is clicked", () => {
			renderWelcomeViewProvider()
			navigateToProviderSetup()

			// Verify we're on provider setup
			expect(screen.getByTestId("api-options")).toBeInTheDocument()

			// Click Back
			const backButton = screen.getByTestId("button-secondary")
			fireEvent.click(backButton)

			// Should be back on landing screen
			expect(screen.getByTestId("afx-hero")).toBeInTheDocument()
			expect(screen.getByText(/welcome:landing.getStarted/)).toBeInTheDocument()
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
