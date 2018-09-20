#!/bin/bash

set -eo pipefail
echo "--- PRINT ENV"
env
echo "--- Deploy to $BUILDKITE_BRANCH"
cd service
if [[ "$BUILDKITE_BRANCH" == "develop" ]]; then
  serverless config credentials --provider aws --key $AWS_ACCESS_KEY_ID --secret $AWS_SECRET_ACCESS_KEY
fi
if [[ "$BUILDKITE_BRANCH" == "staging" ]]; then
  serverless config credentials --provider aws --key $AWS_ACCESS_KEY_ID --secret $AWS_SECRET_ACCESS_KEY
fi
if [[ "$BUILDKITE_BRANCH" == "master" ]]; then
  serverless config credentials --provider aws --key $AWS_ACCESS_KEY_ID_PROD --secret $AWS_SECRET_ACCESS_KEY_PROD
fi
serverless deploy --stage $BUILDKITE_BRANCH