import React, { useEffect, useRef, useState } from 'react';
import init, { CyclicDemons } from '../../crate/pkg/cyclicdemons_core';
import heic2any from 'heic2any';

let wasmInitPromise: Promise<any> | null = null;

export const Visualizer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [visualizer, setVisualizer] = useState<CyclicDemons | null>(null);
    const [wasmMemory, setWasmMemory] = useState<WebAssembly.Memory | null>(null);

    const [isPlaying, setIsPlaying] = useState(true);
    const [colorCount, setColorCount] = useState(64);
    const [sliderColorCount, setSliderColorCount] = useState(64);
    const [stepsPerFrame, setStepsPerFrame] = useState(1);
    const [showDoneToast, setShowDoneToast] = useState(false);

    const animationFrameRef = useRef<number>(0);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const debugTextRef = useRef<HTMLSpanElement>(null);
    const debugSliderRef = useRef<HTMLInputElement>(null);
    const isPlayingRef = useRef(false);
    const stepsPerFrameRef = useRef(1);
    const isImageLoading = useRef(true);
    const hasLoadedDefaultRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
        stepsPerFrameRef.current = stepsPerFrame;
        if (isPlaying && visualizer) {
            setShowDoneToast(false);
            if (!animationFrameRef.current) {
                animate();
            }
        }
    }, [isPlaying, stepsPerFrame, visualizer]);

    const playDoneBeep = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio beep failed", e);
        }
    };

    const triggerDone = () => {
        setIsPlaying(false);
        setShowDoneToast(true);
        playDoneBeep();
        setTimeout(() => setShowDoneToast(false), 3000);
    };

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
        isImageLoading.current = true;
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
        img.onerror = () => {
            console.error("Image failed to load");
            isImageLoading.current = false;
        };
        img.src = url;
    };

    useEffect(() => {
        if (visualizer && wasmMemory && !hasLoadedDefaultRef.current) {
            hasLoadedDefaultRef.current = true;
            processImage('/Monarch.png');
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

    const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
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
            const percent = total > 0 ? (changed / total) * 100 : 0;
            if (debugTextRef.current) {
                const nsynced = visualizer.get_nsynced();
                debugTextRef.current.innerText = `${percent.toFixed(2)}% Changed (Synced: ${nsynced})`;
            }
            if (debugSliderRef.current) {
                debugSliderRef.current.value = percent.toString();
            }
            console.log("CHANGED:", changed);
            renderFrame();
            if (changed === 0 || changed === total) {
                if (changed === total) {
                    console.log(`HALTED! Every pixel is changing simultaneously`);
                }
                const frames = visualizer.get_frame_count();
                if (debugTextRef.current) {
                    debugTextRef.current.innerText = `Halted at Frame ${frames}`;
                }
                triggerDone();
            }
        }
    };

    const resetAutomaton = () => {
        if (visualizer && !isImageLoading.current) {
            visualizer.reset();
            renderFrame();
            setIsPlaying(false);
            setShowDoneToast(false);
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
                const percent = total > 0 ? (changed / total) * 100 : 0;
                if (debugTextRef.current) {
                    const nsynced = visualizer.get_nsynced();
                    debugTextRef.current.innerText = `${percent.toFixed(2)}% Changed (Synced: ${nsynced})`;
                }
                if (debugSliderRef.current) {
                    debugSliderRef.current.value = percent.toString();
                }
                if (changed === 0 || changed === total) {
                    if (changed === total) {
                        console.log(`HALTED! Every pixel is changing simultaneously`);
                    }
                    const frames = visualizer.get_frame_count();
                    if (debugTextRef.current) {
                        debugTextRef.current.innerText = `Halted at Frame ${frames}`;
                    }
                    done = true;
                    triggerDone();
                    break;
                }
            }
            renderFrame();
            
            if (done) {
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
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <canvas 
                        ref={canvasRef} 
                        className="visualizer-canvas"
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        style={{ 
                            opacity: isImageLoading.current ? 0.5 : 1,
                            filter: isDragging ? 'brightness(1.2)' : 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            border: '2px solid transparent',
                            borderColor: isDragging ? '#3498db' : 'transparent',
                            boxShadow: isDragging ? '0 0 20px rgba(52, 152, 219, 0.5)' : '0 4px 6px rgba(0,0,0,0.3)'
                        }}
                        title="Drag and drop an image here to load it"
                    />
                    {showDoneToast && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(46, 204, 113, 0.9)',
                            color: 'white',
                            padding: '15px 30px',
                            borderRadius: '30px',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                            pointerEvents: 'none',
                            animation: 'fadeInOut 3s ease forwards',
                            zIndex: 10
                        }}>
                            Simulation Complete
                        </div>
                    )}
                </div>
            </div>

            <div 
                style={{
                    position: 'fixed',
                    bottom: '15px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#0f0',
                    padding: '5px 15px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    width: '250px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    zIndex: 1000,
                    backdropFilter: 'blur(2px)'
                }}
            >
                <span ref={debugTextRef} style={{ fontWeight: 'bold', fontSize: '12px' }}>0.00% Changed (Synced: 0)</span>
                <input 
                    type="range" 
                    ref={debugSliderRef}
                    min="0" 
                    max="100" 
                    step="0.01"
                    defaultValue="0"
                    style={{ 
                        width: '100%', 
                        pointerEvents: 'none', 
                        accentColor: '#0f0',
                        cursor: 'default'
                    }}
                />
            </div>
        </div>
    );
};
