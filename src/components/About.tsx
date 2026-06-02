import React from 'react';
import '../App.css'; // Re-use main styles or add specific ones

interface AboutProps {
    isOpen: boolean;
    onClose: () => void;
}

export const About: React.FC<AboutProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="about-overlay" onClick={onClose}>
            <div className="about-modal" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>×</button>
                <h2 style={{ marginBottom: '5px' }}>Cyclic Demons</h2>
                <p style={{ marginTop: 0, fontStyle: 'italic', color: '#aaa', fontSize: '0.9em' }}>by david s. maynard and AntiGravity</p>
                <p>WASM-powered Cellular Automaton</p>
                
                <div className="about-content" style={{ marginTop: '20px', textAlign: 'left', fontSize: '0.9em', lineHeight: '1.5' }}>
                    <p>
                        This application is a Cellular Automaton built with React and Rust. It uses a custom WebAssembly engine to extract the dominant colors from any image using the Median Cut Quantization algorithm. Those colors then become states in a Cyclic Demon automaton where colors "eat" each other in a continuous cycle, propagating across the image canvas.
                    </p>
                    <p style={{ marginTop: '15px' }}>
                        A type of cellular automata called cyclic space was discovered by David Griffeath of the University of Wisconsin at Madison in 1990. Cyclic Space is described in <a href="https://www.amazon.com/Magic-Machine-Handbook-Computer-Sorcery/dp/0716721252/ref=sr_1_1?crid=2N7PKFJOVUI49&dib=eyJ2IjoiMSJ9.NTLdsrNDLEk1x3LeOBQyww.nWfU52fpvLMdRJsWOJv1BBOrNoiGSeZ0rMMVjCoi1Ns&dib_tag=se&keywords=the+magic+machine+a.k.+dewdney&qid=1729741595&sprefix=the+magic+machine+a.k.+dewdnet%2Caps%2C169&sr=8-1" target="_blank" rel="noopener noreferrer" style={{ color: '#3498db', textDecoration: 'none' }}>The Magic Machine A Handbook of Computer Sorcery</a> by A.K. Dewdney.
                    </p>
                    
                    <h3 style={{ marginTop: '15px', fontSize: '1em', color: '#ccc' }}>Features</h3>
                    <ul style={{ paddingLeft: '20px' }}>
                        <li>Hardware-accelerated zero-copy WASM core</li>
                        <li>Cyclic Demon Automaton with toroidal wrap around</li>
                        <li>Dynamic Color Quantization via Median Cut</li>
                        <li>Drag-and-drop support for local image files (including HEIC)</li>
                    </ul>

                    <div style={{ marginTop: '25px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <a 
                            href="https://github.com/dmaynard/cyclicdemons" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#3498db', textDecoration: 'none', fontWeight: 'bold' }}
                        >
                            View Source on GitHub
                        </a>
                        <a 
                            href="https://davidsmaynard.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#3498db', textDecoration: 'none', fontWeight: 'bold' }}
                        >
                            Visit davidsmaynard.com
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
