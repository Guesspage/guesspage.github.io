# Risk Assessment for a Construction Project

This example demonstrates how to use probabilistic modeling for risk assessment in a construction project.

## Project Overview

Let's consider a high-rise building construction project with the following key risk areas:
1. Budget Overruns
2. Schedule Delays
3. Safety Incidents
4. Quality Issues
5. Regulatory Compliance

## Budget Risk

Let's model the budget risk:

Estimated budget: [estimated_budget = 10000000] ($10 million estimated budget)
Budget overrun factor: [budget_overrun_factor = normal(1.1, 0.05)] (10% average overrun with 5% standard deviation)

Actual budget: [actual_budget = estimated_budget * budget_overrun_factor]
Budget overrun: [budget_overrun = actual_budget - estimated_budget]

## Schedule Risk

Now, let's consider schedule risk:

Estimated duration: [estimated_duration = 24] (24 months estimated duration)
Schedule delay factor: [schedule_delay_factor = normal(1.15, 0.1)] (15% average delay with 10% standard deviation)

Actual duration: [actual_duration = estimated_duration * schedule_delay_factor]
Schedule delay: [schedule_delay = actual_duration - estimated_duration]

## Safety Risk

Let's model the safety risk:

Minor incidents: [minor_incidents = normal(7, 2)] (7 minor incidents on average with standard deviation of 2)
Major incidents: [major_incidents = normal(1, 0.5)] (1 major incident on average with standard deviation of 0.5)

Total safety incidents: [total_safety_incidents = minor_incidents + major_incidents]

## Quality Risk

For quality risk, let's consider the number of defects:

Defects per floor: [defects_per_floor = normal(15, 3)]
Number of floors: [number_of_floors = 30]

Total defects: [total_defects = defects_per_floor * number_of_floors]

## Regulatory Compliance Risk

Let's model the risk of regulatory issues:

Compliance score: [compliance_score = normal(95, 3)] (95% compliance score on average with 3% standard deviation)
Regulatory violations: [regulatory_violations = max(0, (100 - compliance_score) / 10)]

## Risk Mitigation Effectiveness

Let's consider the effectiveness of our risk mitigation strategies:

Budget mitigation effectiveness: [budget_mitigation_effectiveness = uniform(0.7, 0.9)] (70-90% effective)
Schedule mitigation effectiveness: [schedule_mitigation_effectiveness = uniform(0.6, 0.8)] (60-80% effective)
Safety mitigation effectiveness: [safety_mitigation_effectiveness = uniform(0.8, 0.95)] (80-95% effective)
Quality mitigation effectiveness: [quality_mitigation_effectiveness = uniform(0.75, 0.9)] (75-90% effective)
Compliance mitigation effectiveness: [compliance_mitigation_effectiveness = uniform(0.85, 0.98)] (85-98% effective)

## Adjusted Risks

Now, let's adjust our risks based on mitigation effectiveness:

Adjusted budget overrun: [adjusted_budget_overrun = budget_overrun * (1 - budget_mitigation_effectiveness)]
Adjusted schedule delay: [adjusted_schedule_delay = schedule_delay * (1 - schedule_mitigation_effectiveness)]
Adjusted safety incidents: [adjusted_safety_incidents = total_safety_incidents * (1 - safety_mitigation_effectiveness)]
Adjusted defects: [adjusted_defects = total_defects * (1 - quality_mitigation_effectiveness)]
Adjusted violations: [adjusted_violations = regulatory_violations * (1 - compliance_mitigation_effectiveness)]

## Overall Project Risk Score

Let's create an overall project risk score (0-100, where higher is riskier):

Budget risk score: [budget_risk_score = min(100, (adjusted_budget_overrun / estimated_budget) * 100)]
Schedule risk score: [schedule_risk_score = min(100, (adjusted_schedule_delay / estimated_duration) * 100)]
Safety risk score: [safety_risk_score = min(100, adjusted_safety_incidents * 5)] (5 points per incident)
Quality risk score: [quality_risk_score = min(100, (adjusted_defects / (number_of_floors * 10)) * 100)] (Assuming 10 defects per floor is 100% risk)
Compliance risk score: [compliance_risk_score = min(100, adjusted_violations * 20)] (20 points per violation)

Overall risk score: [overall_risk_score = (budget_risk_score + schedule_risk_score + safety_risk_score + quality_risk_score + compliance_risk_score) / 5]

This model helps project managers assess various risks in a construction project, evaluate the effectiveness of mitigation strategies, and get an overall risk score. It can be customized with specific project data and risk factors for more accurate assessment.
