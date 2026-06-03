# Cyclic Demons

**Authored by David S. Maynard (with AntiGravity assist)**

A high-performance, browser-based Cellular Automaton built with **React** and a custom **Rust WebAssembly (WASM)** core. This application uses a custom WebAssembly engine to extract the dominant colors from any image using the Median Cut Quantization algorithm. Those colors then become states in a Cyclic Demon automaton where colors "eat" each other in a continuous cycle, propagating across the image canvas.

A type of cellular automata called cyclic space was discovered by David Griffeath of the University of Wisconsin at Madison in 1990. Cyclic Space is described in [The Magic Machine: A Handbook of Computer Sorcery](https://www.amazon.com/Magic-Machine-Handbook-Computer-Sorcery/dp/0716721252) by A.K. Dewdney.

---

## Features

- **Custom Image Uploads**: Drag and drop your own `.png`, `.jpg`, or `.heic` images directly onto the canvas, or use the built-in UI buttons to upload files.
- **Dynamic Color Quantization**: The WASM core mathematically analyzes the uploaded image to extract the top distinct colors that represent the image's palette using the Median Cut algorithm.
- **Hardware-Accelerated Zero-Copy WASM Core**: The mathematical heavy lifting is done in Rust and compiled to `.wasm`, ensuring high performance and 60 FPS rendering without garbage collection stutters.
- **Cyclic Demon Automaton**: Implements Toroidal wrap-around and cellular automaton logic where colors progress in a cycle to "eat" neighboring cells.

---

## Basic Architecture

The project bridges the gap between browser APIs and systems-level performance by splitting responsibilities across two layers:

### 1. The Frontend (React + TypeScript + Vite)
The React application acts as the conductor. It handles all of the UI state, user interactions, and DOM rendering. 
- It manages the **HTML5 `<canvas>`** element, pushing the final rendered image to the screen using `requestAnimationFrame`.
- It processes local file uploads (including HEIC conversion) and handles drag-and-drop events.

### 2. The Core Engine (Rust + WebAssembly)
To achieve high performance without lagging the browser, the heavy mathematical lifting and cellular automaton logic is executed in Rust and compiled to `.wasm`.
- **Zero-Copy Memory**: Instead of passing massive arrays of pixel data back and forth between JavaScript and Rust (which would cause massive garbage collection spikes), the Rust core allocates a static chunk of memory. Rust writes the modified image pixels directly into a shared buffer that the `<canvas>` paints from.
- **Color Quantization**: The Rust core implements a custom **Median Cut algorithm** to efficiently scan pixels and cluster them into a deterministic color palette.
- **Automaton Engine**: The core manages the 2D grid of cells, executing the cyclic automaton rules on every frame to simulate the cycle of colors taking over their neighbors.

---

## Running Locally

1. Install dependencies: `npm install`
2. Build the WASM core: `npm run build:wasm` *(Requires the Rust toolchain and `wasm-pack`)*
3. Start the dev server: `npm run dev`

---

## Links

- [Source Code on GitHub](https://github.com/dmaynard/cyclicdemons)
- [David S. Maynard's Website](https://davidsmaynard.com)

---

## License

**MIT License**

Copyright (c) 2026 David S. Maynard

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
