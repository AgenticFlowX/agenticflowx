#!/bin/bash

# Copyright 2026 AgenticFlowX contributors
# SPDX-License-Identifier: Apache-2.0
#
# Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
# Original work by Saoud Rizwan (Claude Dev)


# Set environment variable to suppress WSL install prompt for VS Code
export DONT_PROMPT_WSL_INSTALL=1

if [ $# -eq 0 ]; then
    exec bash
else
    exec "$@"
fi
