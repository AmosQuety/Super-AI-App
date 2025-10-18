/** @type {import('tailwindcss').Config} */
module.exports = {
    
      content: [   
    "./app/**/*.{js,ts,tsx}",
    "./components/**/*.{js,ts,tsx}"],
    
    presets: [require("nativewind/preset")],
    theme: {
      extend: {
         colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
        }
      }
      },
    },
    plugins: [],
  }
