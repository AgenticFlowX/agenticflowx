// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { AfxPanel } from "./components/agenticflowx/AfxPanel"

createRoot(document.getElementById("afx-root")!).render(
	<StrictMode>
		<AfxPanel />
	</StrictMode>,
)
