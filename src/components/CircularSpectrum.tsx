import React from 'react';
import { motion } from 'framer-motion';

interface CircularSpectrumProps {
  isPlaying: boolean;
}

export default function CircularSpectrum({ isPlaying }: CircularSpectrumProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="absolute w-64 h-64 rounded-full overflow-hidden opacity-80"
        initial={{ opacity: 0 }}
        animate={{ opacity: isPlaying ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: 'transparent',
        }}
      >
        <img
          src="https://claudia.zetamind.com/57c3095522012bd961e7dee3e0818c67.gif"
          alt="Animation"
          className="absolute w-[150%] h-[150%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-cover"
          style={{
            mixBlendMode: 'plus-lighter', // Better for dark mode
          }}
        />
      </motion.div>
    </div>
  );
}