#!/bin/bash

# Copyright 2026 AgenticFlowX contributors
# SPDX-License-Identifier: Apache-2.0
#
# Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
# Original work by Saoud Rizwan (Claude Dev)


set -e
set -u

if [ -n "$POSTGRES_DATABASES" ]; then
  for db in $(echo $POSTGRES_DATABASES | tr ',' ' '); do
    echo "Creating $db..."
    psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db;"
  done
fi
