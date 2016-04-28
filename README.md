# AWS Lambda Project Boilerplate
This is a small project that works as a starting point for a project that will be deployed to AWS Lambda.

## Kick-off
```
npm install
```

##Introduction

If you're new to Lambda, the next section contains a very general overview of how it works. You can also see these links for in-depth information:

- [How It Works](http://docs.aws.amazon.com/lambda/latest/dg/lambda-introduction.html)
- [Programming Model](http://docs.aws.amazon.com/lambda/latest/dg/programming-model-v2.html)
- [Node.js Programming Model](http://docs.aws.amazon.com/lambda/latest/dg/programming-model.html)
- [Tutorial using AWS CLI](http://docs.aws.amazon.com/lambda/latest/dg/getting-started.html)

## Lambda Overview

The Lambda programming model boils down to this:

- Lambda is event based. This means that a Lambda function is called as a response to an event (e.g. a scheduled task, hitting an endpoint, an AWS API call).
- Each Lambda function is run in a stateless environment. This means that you shouldn't make any assumptions or have any expectations about hosting environment.
- Each Lambda function contains one or more files containing code that must all be available from the beginning (including dependencies, such as npm packages). In one of those files, there needs to be a function to handle the event. What that handler is is defined in the Lambda function configuration.
- Handler functions are the single entry point into a Lambda function. They can, however, call any code contained in any of the other files.
- Handler functions receive the event data as the first argument. The format of this data is defined by the developer.
- Handler functions also receive a context object that allows them to interact with Lambda at run time. (See **Programming Model** above)
