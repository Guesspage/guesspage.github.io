# Manufacturing Process Optimization

This example demonstrates how to use probabilistic modeling to optimize a manufacturing process.

## Production Line

Let's consider a production line with four main stages:
1. Raw Material Processing
2. Assembly
3. Quality Control
4. Packaging

## Processing Times

We'll model the processing time (in minutes) for each stage using triangular distributions:

Raw Material Processing: [raw_material_time = triangular(8, 10, 15)] minutes
Assembly: [assembly_time = triangular(18, 20, 30)] minutes
Quality Control: [quality_control_time = triangular(4, 5, 10)] minutes
Packaging: [packaging_time = triangular(7, 8, 12)] minutes

## Total Production Time

The total production time for one unit is the sum of all stage times: [total_time = raw_material_time + assembly_time + quality_control_time + packaging_time] minutes.

## Defect Rates

Let's model the defect rates at each stage:

Raw Material defect rate: [raw_material_defect_rate = uniform(0.02, 0.05)] (2-5% defect rate)
Assembly defect rate: [assembly_defect_rate = uniform(0.03, 0.07)] (3-7% defect rate)
Quality Control miss rate: [qc_miss_rate = uniform(0.01, 0.03)] (1-3% of defects missed by QC)

## Overall Defect Rate

The overall defect rate considers defects from each stage and those missed by quality control: [overall_defect_rate = (raw_material_defect_rate + assembly_defect_rate) * (1 - qc_miss_rate)]

## Machine Downtime

Let's factor in potential machine downtime: [downtime_hours_per_day = uniform(0.5, 2)] (0.5 to 2 hours of downtime per day)

## Daily Production Capacity

Assuming an 8-hour workday:

Available minutes: [available_minutes = (8 - downtime_hours_per_day) * 60]
Units per day: [units_per_day = available_minutes / total_time]

## Production Costs

Let's consider the costs associated with production:

Material cost per unit: [material_cost_per_unit = normal(25, 5)]
Labor cost per hour: [labor_cost_per_hour = normal(20, 3)]
Overhead cost per day: [overhead_cost_per_day = normal(750, 100)]

## Total Daily Cost

The total daily cost is: [total_daily_cost = (units_per_day * material_cost_per_unit) + (8 * labor_cost_per_hour) + overhead_cost_per_day]

## Cost Per Unit

The cost per unit is: [cost_per_unit = total_daily_cost / units_per_day]

## Optimization Goals

Let's set some optimization goals:

1. Produce at least 100 units per day: [meets_production_goal = if(units_per_day >= 100, 1, 0)]
2. Keep the defect rate below 5%: [meets_quality_goal = if(overall_defect_rate <= 0.05, 1, 0)]
3. Keep the cost per unit below $50: [meets_cost_goal = if(cost_per_unit <= 50, 1, 0)]

## Overall Process Efficiency

The overall process efficiency is: [process_efficiency = meets_production_goal * meets_quality_goal * meets_cost_goal]

This model helps manufacturing managers understand the interactions between different stages of the production process, identify bottlenecks, and assess the likelihood of meeting production, quality, and cost goals. It can be refined with actual data from the production line for more accurate optimization.
