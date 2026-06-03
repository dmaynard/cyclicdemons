# Chasing Cyclic Demons: Building a 60FPS Cellular Automaton in the Browser with Rust & WebAssembly

There is something inherently mesmerizing about cellular automata. You define a set of simple, localized rules, hit "play," and watch as complex, macroscopic patterns emerge from chaos. 

Recently, I decided to build a browser-based visualization of a specific type of cellular automaton called **Cyclic Space**, discovered by David Griffeath of the University of Wisconsin in 1990 and detailed in A.K. Dewdney's *The Magic Machine*. 

In Cyclic Space, each cell is assigned a state (a color) from `0` to `N-1`. The rule is simple: a cell is "eaten" by a neighboring cell if that neighbor’s state is exactly one step ahead in the cycle. Colors consume their neighbors in a continuous, toroidal loop, eventually crystallizing into beautiful, infinite spirals.

You can play with the live version here: **[Insert Link to Netlify App]**  
*(Source code available on [GitHub](https://github.com/dmaynard/cyclicdemons))*

---

## 🚀 The Tech Stack: Why Rust and WebAssembly?

I wanted this to be a highly interactive web app where users could drag-and-drop their own images, have the system extract the colors, and run the automaton on those exact colors. 

Running a pixel-by-pixel simulation on high-resolution images (potentially over a million pixels) at 60 frames-per-second is tough in pure JavaScript. The garbage collection spikes alone from allocating massive arrays every frame would cause severe stuttering.

To solve this, I split the architecture:
*   **The Frontend (React + TypeScript):** Handles the UI, drag-and-drop file inputs, and paints the final output to an HTML5 `<canvas>`.
*   **The Engine (Rust + WASM):** Handles all the heavy mathematical lifting and grid traversal. 

By using WebAssembly, I could allocate a static chunk of memory (a **Zero-Copy Buffer**). Rust writes the modified image pixels directly into this shared memory buffer, and the JavaScript `<canvas>` reads from it directly without any cloning or garbage collection. While the exact framerate still depends on the size of the uploaded image, this architecture allows the simulation to run orders of magnitude faster (and on much larger images) than a pure JavaScript implementation could handle.

## 🎨 Dynamic States via Median Cut Quantization

Instead of hardcoding a set of colors, the states of the automaton are generated dynamically based on whatever image the user uploads. 

When you drop an image onto the canvas, the Rust core runs a custom implementation of the **Median Cut algorithm**. It scans the millions of pixels in the image and efficiently clusters them into a deterministic color palette (e.g., the top 16 or 32 distinct colors that represent the image). 

Those colors then become the exact states of the `0` to `N-1` cycle.

## 🤯 The "Aha!" Debugging Moment: Finding the Halting Period

One of the most interesting challenges during development was figuring out **when to halt the simulation**. 

Eventually, the chaotic mixing phase ends, and the board is dominated by stable, repeating spirals. I wanted the UI to automatically detect this and pause. To do this, I started tracking a global count of *how many pixels changed state* on every frame.

Logically, if there are `N` colors in the cycle, you would expect an individual cell to return to its original state exactly every `N` frames. Therefore, the global count of changed pixels should also repeat with a perfect period of `N`. 

I wrote a test: keep a sliding window array of the last `N` changes. If the current number of changed pixels exactly matches the number from `N` frames ago, start incrementing a `Synced` counter. If `Synced > N`, halt the simulation.

**It didn't halt.** 

I suspected a bug in my implementation. To find out what was happening, I added a "dump history" button to output the last 256 frame-change counts to a text file for manual analysis. 

When I analyzed the log, I found something fascinating. The sequence *was* perfectly repeating, but **the period was exactly N+1**. 

While the individual localized waves cycle through the `N` states, the way those waves overlap and wrap around the toroidal (pac-man style) edges of the macroscopic grid creates an interference pattern. The global sum of changing cells takes exactly one extra frame to perfectly realign. 

Updating the halting logic to look back `N+1` frames worked instantly. The moment the board crystallizes into stable spirals, the automaton perfectly detects the cycle and halts.

## Conclusion

Building this was a fantastic exercise in optimizing browser performance and a great reminder of how unpredictable emergent systems can be. The math isn't just theory—it actively dictates how you have to write your termination loops!

If you want to try it out, upload a picture of your dog or your favorite album cover and watch the demons take over.

*Check out the [Live Demo](#) or dig into the [GitHub Repo](https://github.com/dmaynard/cyclicdemons).*
