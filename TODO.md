# TODO

## Miscellaneous

- For numeric fields, add the ability to edit them (spinner?) dynamically in the view mode.
- Let user edit the formula in the info card on the right. Write it back to the raw mode.
- Draw (faint) dependency arrows between cells to visualize the formula
- Create a menu dropdown with several example pages.

## The Big Sampler Rewrite

- Sample in chunks of 1024 to amortize function calls. (Loops are easy to compile.)
- Instead of storing the results, introduce "probes". A probe is a class that consumes chunks from the sampler.
  A probe can say when it's done. Keep sampling until all probes are satisfied.
  For instance, the 'from .. to' CellProbe is satisfied when it notices that there's a <1% chance that the
  number that it shows will change another digit.
  The 'ChartProbe' samples the first chunk to determine buckets; then it samples until there's a <10% chance that any
  bucket will change by more than a pixel.
- There should probably be a diagnostic somewhere on the UI (status bar?) that shows when we're sampling,
  at what rate, and how often we've sampled.
