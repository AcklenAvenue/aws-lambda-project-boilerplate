#!/bin/bash

set -eo pipefail
echo "--- Deploy to $BUILDKITE_BRANCH"
serverless deploy