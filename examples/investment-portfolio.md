# Investment Portfolio Analysis

This example demonstrates how to use probabilistic modeling to analyze an investment portfolio.

## Portfolio Components

Let's consider a portfolio with three main components:
1. Stocks
2. Bonds
3. Real Estate

## Historical Returns

We'll use normal distributions to model the annual returns of each component, based on historical data:

Stocks: [stock_return = normal(0.10, 0.20)] (10% average return, high volatility)
Bonds: [bond_return = normal(0.05, 0.08)] (5% average return, lower volatility)
Real Estate: [real_estate_return = normal(0.07, 0.12)] (7% average return, medium volatility)

## Portfolio Allocation

Let's define our portfolio allocation:

Stocks: [stock_allocation = 0.50] (50%)
Bonds: [bond_allocation = 0.30] (30%)
Real Estate: [real_estate_allocation = 0.20] (20%)

## Portfolio Return

Now, let's calculate the overall portfolio return: [portfolio_return = (stock_return * stock_allocation) + (bond_return * bond_allocation) + (real_estate_return * real_estate_allocation)]

## Risk Analysis

Let's consider some risk scenarios:

Market crash: [market_crash = uniform(0.8, 1)] (1 means no crash, 0.8 means 20% market decline)
Interest rate change: [interest_rate_change = uniform(1, 1.1)] (1 means no change, 1.1 means 10% interest rate increase)

## Adjusted Portfolio Return

Now, let's adjust our portfolio return based on these risk factors: [adjusted_portfolio_return = portfolio_return * market_crash * interest_rate_change]

## Investment Goal

Let's say our investment goal is to achieve at least a 7% annual return. What's the probability of meeting this goal? [meets_goal = if(adjusted_portfolio_return >= 0.07, 1, 0)]

This simulation helps investors understand the potential returns and risks associated with their portfolio allocation, and the likelihood of meeting their investment goals under various market conditions.
