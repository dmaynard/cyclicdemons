import React, { useEffect, useRef, useState } from 'react';
import init, { CyclicDemons } from '../../crate/pkg/cyclicdemons_core';
import heic2any from 'heic2any';

let wasmInitPromise: Promise<any> | null = null;

export const Visualizer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [visualizer, setVisualizer] = useState<CyclicDemons | null>(null);
    const [wasmMemory, setWasmMemory] = useState<WebAssembly.Memory | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [colorCount, setColorCount] = useState(24);
    const [sliderColorCount, setSliderColorCount] = useState(24);
    const [stepsPerFrame, setStepsPerFrame] = useState(1);

    const animationFrameRef = useRef<number>(0);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const isPlayingRef = useRef(false);
    const stepsPerFrameRef = useRef(1);
    const isImageLoading = useRef(false);
    const hasLoadedDefaultRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
        stepsPerFrameRef.current = stepsPerFrame;
        if (isPlaying && !animationFrameRef.current) {
            animate();
        }
    }, [isPlaying, stepsPerFrame]);

    useEffect(() => {
        const loadWasm = async () => {
            if (!wasmInitPromise) {
                wasmInitPromise = init();
            }
            const module = await wasmInitPromise;
            setWasmMemory(module.memory);
            console.log("Visualizer: WASM module loaded");
            const viz = new CyclicDemons();
            setVisualizer(viz);
        };
        loadWasm();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (sliderColorCount !== colorCount) {
                handleColorCountChange(sliderColorCount);
            }
        }, 300); // 300ms debounce
        return () => clearTimeout(handler);
    }, [sliderColorCount, colorCount]);

    const processImage = (url: string) => {
        const img = new Image();
        img.onload = () => {
            const MAX_W = 1600;
            const MAX_H = 1200;
            let w = img.width;
            let h = img.height;

            const scale = Math.min(1.0, Math.min(MAX_W / w, MAX_H / h));
            w = Math.floor(w * scale);
            h = Math.floor(h * scale);

            const offscreen = document.createElement('canvas');
            offscreen.width = w;
            offscreen.height = h;
            const ctx = offscreen.getContext('2d');
            if (!ctx) return;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            const imageData = ctx.getImageData(0, 0, w, h);
            const data = new Uint8Array(imageData.data.buffer);

            try {
                isImageLoading.current = true;
                if (!visualizer || !wasmMemory) throw new Error("WASM not ready");

                const uploadPtr = visualizer.get_upload_buffer_ptr();
                if (uploadPtr === 0) throw new Error("Failed to get upload buffer pointer");

                const wasmUploadBuffer = new Uint8Array(wasmMemory.buffer, uploadPtr, data.length);
                wasmUploadBuffer.set(data);

                visualizer.load_image(w, h);
                visualizer.set_color_count(colorCount);

                resizeCanvas();
                renderFrame();

                isImageLoading.current = false;
            } catch (err) {
                console.error("Error loading image:", err);
                isImageLoading.current = false;
            }
        };
        img.src = url;
    };

    useEffect(() => {
        if (visualizer && wasmMemory && !hasLoadedDefaultRef.current) {
            hasLoadedDefaultRef.current = true;
            processImage('/FlammarionColor.png');
        }
    }, [visualizer, wasmMemory]);

    const processImageFile = async (file: File) => {
        try {
            if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
                setIsConverting(true);
                const convertedBlob = await heic2any({ blob: file, toType: 'image/png' });
                const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                const url = URL.createObjectURL(blobToUse);
                setIsConverting(false);
                processImage(url);
            } else {
                const url = URL.createObjectURL(file);
                processImage(url);
            }
        } catch (error) {
            setIsConverting(false);
            console.error("Error processing image file:", error);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.heic')) {
                await processImageFile(file);
            }
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processImageFile(e.target.files[0]);
            e.target.value = '';
        }
    };

    const handleColorCountChange = (count: number) => {
        setColorCount(count);
        if (visualizer) {
            try {
                isImageLoading.current = true;
                visualizer.set_color_count(count);
                isImageLoading.current = false;
                if (visualizer.get_width() > 0) {
                    renderFrame();
                }
            } catch (e) {
                console.error("Error setting color count:", e);
                isImageLoading.current = false;
            }
        }
    };

    const resizeCanvas = () => {
        if (!visualizer || !canvasRef.current) return;
        canvasRef.current.width = visualizer.get_width();
        canvasRef.current.height = visualizer.get_height();
    };

    const renderFrame = () => {
        if (!visualizer || !canvasRef.current || !wasmMemory) return;
        const width = visualizer.get_width();
        const height = visualizer.get_height();
        if (width === 0 || height === 0) return;

        if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
        }

        visualizer.render();
        const bufferPtr = visualizer.get_display_buffer_ptr();
        const len = visualizer.get_display_buffer_len();

        const memBuffer = new Uint8Array(wasmMemory.buffer);
        const imageBuffer = new Uint8ClampedArray(memBuffer.subarray(bufferPtr, bufferPtr + len));
        const imageData = new ImageData(imageBuffer, width, height);

        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.putImageData(imageData, 0, 0);
        }
    };

    const stepAutomaton = () => {
        if (visualizer && !isImageLoading.current) {
            const changed = visualizer.step();
            const total = visualizer.get_width() * visualizer.get_height();
            const virgin = visualizer.get_virgin_count();
            renderFrame();
            if (changed === 0 || changed === total || virgin === 0) {
                setIsPlaying(false);
            }
        }
    };

    const resetAutomaton = () => {
        if (visualizer && !isImageLoading.current) {
            visualizer.reset();
            renderFrame();
            setIsPlaying(false);
        }
    };

    const animate = () => {
        if (!visualizer || !wasmMemory) return;

        if (!isPlayingRef.current) {
            animationFrameRef.current = 0;
            return;
        }

        if (!isImageLoading.current) {
            let done = false;
            for (let i = 0; i < stepsPerFrameRef.current; i++) {
                const changed = visualizer.step();
                const total = visualizer.get_width() * visualizer.get_height();
                const virgin = visualizer.get_virgin_count();
                if (changed === 0 || changed === total || virgin === 0) {
                    done = true;
                    break;
                }
            }
            renderFrame();
            
            if (done) {
                setIsPlaying(false);
                animationFrameRef.current = 0;
                return;
            }
        }

        animationFrameRef.current = requestAnimationFrame(animate);
    };

    return (
        <div 
            className="visualizer-container"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ position: 'relative' }}
        >
            {isConverting && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <h3 style={{ color: 'white' }}>Converting HEIC...</h3>
                </div>
            )}
            {isDragging && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '4px dashed rgba(255, 255, 255, 0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 style={{ color: 'white' }}>Drop image to upload</h2>
                </div>
            )}

            <div className="playback-controls" style={{ marginTop: '10px' }}>
                <input
                    type="file"
                    accept="image/*,.heic"
                    style={{ display: 'none' }}
                    ref={imageInputRef}
                    onChange={handleImageUpload}
                />
                
                <button 
                    className="control-btn" 
                    onClick={() => imageInputRef.current?.click()} 
                >
                    🖼️ Load Image
                </button>

                <span style={{ borderLeft: '1px solid #444', height: '20px', display: 'inline-block', verticalAlign: 'middle', margin: '0 5px' }}></span>

                <button className="control-btn" onClick={resetAutomaton} title="Rewind">⏮</button>
                <button className="control-btn" onClick={stepAutomaton} title="Step Forward">⏭</button>
                {!isPlaying ? (
                    <button className="control-btn" onClick={() => setIsPlaying(true)} title="Play">▶</button>
                ) : (
                    <button className="control-btn" onClick={() => setIsPlaying(false)} title="Pause">⏸</button>
                )}
            </div>

            <div className="settings-panel">
                <span style={{ fontWeight: 'bold', marginRight: '10px' }}>Colors:</span>
                <input 
                    type="range" 
                    min="4" 
                    max="64" 
                    step="1" 
                    value={sliderColorCount} 
                    onChange={e => setSliderColorCount(parseInt(e.target.value))} 
                    disabled={!visualizer}
                    style={{ verticalAlign: 'middle', width: '150px' }}
                />
                <span style={{ marginLeft: '10px', display: 'inline-block', width: '25px' }}>{sliderColorCount}</span>

                <span style={{ fontWeight: 'bold', marginLeft: '20px' }}>Speed:</span>
                <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="1" 
                    value={stepsPerFrame} 
                    onChange={e => setStepsPerFrame(parseInt(e.target.value))} 
                    disabled={!visualizer}
                    style={{ verticalAlign: 'middle' }}
                />
                <span>{stepsPerFrame}x</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <canvas 
                    ref={canvasRef} 
                    style={{ 
                        maxWidth: '100%', 
                        maxHeight: '75vh', 
                        objectFit: 'contain', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        backgroundColor: '#111' 
                    }} 
                />
            </div>
        </div>
    );
};
