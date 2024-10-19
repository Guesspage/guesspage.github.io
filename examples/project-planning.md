# Project Planning Example

This example demonstrates how to use probabilistic estimation for project planning.

## Project Tasks

Let's break down a software development project into key tasks:

1. Requirements Gathering
2. Design
3. Implementation
4. Testing
5. Deployment

## Task Duration Estimates

For each task, we'll estimate the duration in days using a triangular distribution:

Requirements Gathering: [requirements_duration = triangular(3, 5, 10)] days
Design: [design_duration = triangular(5, 7, 14)] days
Implementation: [implementation_duration = triangular(15, 20, 40)] days
Testing: [testing_duration = triangular(7, 10, 20)] days
Deployment: [deployment_duration = triangular(2, 3, 7)] days

## Total Project Duration

The total project duration is the sum of all task durations: [total_duration = requirements_duration + design_duration + implementation_duration + testing_duration + deployment_duration] days.

## Risk Analysis

Let's consider some risk factors that might affect the project duration:

Scope creep: [scope_creep = uniform(1, 1.2)] (1 means no scope creep, 1.2 means 20% increase)
Team productivity: [team_productivity = normal(1, 0.1)] (1 is average, below 1 is lower productivity, above 1 is higher)

## Adjusted Project Duration

Now, let's adjust our total duration based on these risk factors: [adjusted_duration = total_duration * scope_creep / team_productivity] days.

## Deadline

Let's say we have a deadline of 60 days. What's the probability of meeting this deadline? [meets_deadline = if(adjusted_duration <= 60, 1, 0)]

This simulation helps project managers understand the likelihood of meeting deadlines and the impact of various risk factors on project duration.
