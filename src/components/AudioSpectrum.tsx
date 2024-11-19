import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface AudioSpectrumProps {
  isPlaying: boolean;
}

export default function AudioSpectrum({ isPlaying }: AudioSpectrumProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current || wavesurferRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#2F9682',
      progressColor: '#4FD1C5',
      cursorWidth: 0,
      height: 40,
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      normalize: true,
      interact: false,
    });

    // Load empty audio to initialize the waveform
    const emptyBlob = new Blob([new ArrayBuffer(44)], { type: 'audio/wav' });
    wavesurferRef.current.loadBlob(emptyBlob);

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!wavesurferRef.current) return;

    const updateWaveform = () => {
      if (!wavesurferRef.current) return;
      
      if (isPlaying) {
        // Generate random heights for visualization
        const peaks = Array.from({ length: 100 }, () => Math.random());
        wavesurferRef.current.load(
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
          peaks
        );
      } else {
        const emptyPeaks = Array(100).fill(0);
        wavesurferRef.current.load(
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
          emptyPeaks
        );
      }
    };

    let animationFrame: number;
    if (isPlaying) {
      const animate = () => {
        updateWaveform();
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
    } else {
      updateWaveform();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying]);

  return <div ref={containerRef} className="w-full h-10" />;
}