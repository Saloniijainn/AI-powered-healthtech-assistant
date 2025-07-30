// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        // Define the keyframe for a general pop-in effect
        popIn: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '80%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // Define the keyframe for a slight bounce/pop, like a bubble
        bubblePop: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' }, // Slightly larger at midpoint
        },
        // Dot animation for typing indicator
        bounceDot: {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-3px)' },
        },
        // Pulse for online indicator
        pulseFade: {
            '0%, 100%': { opacity: '1' },
            '50%': { opacity: '0.5' },
        },
      },
      animation: {
        // Apply the keyframe to an animation utility class
        'pop-in': 'popIn 0.3s ease-out forwards',
        'bubble-pop': 'bubblePop 0.2s ease-out', // Make it quick
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', // Example for slower pulse
        'animate-pulse': 'pulseFade 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite', // Overriding default pulse for avatars if needed
      },
    },
  },
  plugins: [],
}