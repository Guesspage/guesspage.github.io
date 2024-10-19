# Basic Probability Example

This example demonstrates basic probability concepts using a simple dice roll scenario.

## Dice Roll

Let's consider rolling a six-sided die: [die_result = round(uniform(0, 6) + 0.5)]. The result of rolling a fair six-sided die should be a number between 1 and 6, with an average of 3.5.

## Probability of Even Number

The probability of rolling an even number (2, 4, or 6) is: [even_probability = if(die_result % 2 == 0, 1, 0)]. Over many rolls, this should approach 0.5 or 50%.

## Sum of Two Dice

Now, let's consider the sum of rolling two dice: [die1 = round(uniform(0, 6) + 0.5)] and [die2 = round(uniform(0, 6) + 0.5)], summing up to [sum_of_dice = die1 + die2]. The sum should range from 2 to 12, with 7 being the most common result.

## Probability of Sum Being 7

The probability of the sum being exactly 7 is: [sum_is_7 = if(sum_of_dice == 7, 1, 0)]. This probability should be about 1/6 or approximately 0.167.

By running this simulation many times, we can see how the actual results compare to the theoretical probabilities.
