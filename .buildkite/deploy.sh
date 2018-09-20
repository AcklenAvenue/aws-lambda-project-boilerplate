#!/bin/bash

set -eo pipefail
echo "--- Deploy to $BUILDKITE_BRANCH"
cd service
serverless deploy --stage $BUILDKITE_BRANCH