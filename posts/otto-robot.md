---
title: Getting a years-old Otto robot kit to walk
date: 2026-10-07
project: Otto DIY
summary: A 3D-printed robot kit sat unfinished for years. In October it finally took its first steps.
status: working
time: TODO
cost: TODO
difficulty: 3
draft: true
---

## What I set out to do

I bought an Otto DIY robot kit years ago to print a small walking robot. It stalled out and sat on a shelf. This fall I decided to finally get it working.

TODO: why now, and what "done" meant to you.

## How it went

TODO: printing, assembly, wiring, getting code onto the board.

## What broke

TODO: what went wrong along the way.

The last step to get it walking was setting the servo trims, which correct for each servo's resting position being a little off:

```cpp
Otto.setTrims(-12, 1, -5, -6);
```

TODO: how you found those numbers.

## What I'd do differently

TODO
