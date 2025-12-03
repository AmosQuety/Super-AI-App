// src/utils/themeUtils.ts

export const themeClasses = {
  // Backgrounds
  bgPrimary: "bg-gray-50 dark:bg-gray-900",
  bgSecondary: "bg-white dark:bg-gray-800",
  bgTertiary: "bg-slate-100 dark:bg-slate-800",
  
  // Text
  textPrimary: "text-gray-900 dark:text-white",
  textSecondary: "text-gray-600 dark:text-gray-300",
  textTertiary: "text-gray-500 dark:text-gray-400",
  
  // Borders
  borderLight: "border-gray-200 dark:border-gray-700",
  borderMedium: "border-gray-300 dark:border-gray-600",
  borderDark: "border-gray-400 dark:border-gray-500",
  
  // Buttons
  buttonPrimary: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white",
  buttonSecondary: "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200",
  
  // Inputs
  input: "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400",
  
  // Gradients
  gradientPrimary: "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500",
  gradientBluePurple: "bg-gradient-to-r from-blue-500 to-purple-500",
  gradientPurplePink: "bg-gradient-to-r from-purple-500 to-pink-500",
};

// Helper function to get theme-aware class names
export const getThemeClass = (baseClass: string, theme: 'light' | 'dark') => {
  const themeSuffix = theme === 'dark' ? 'dark' : 'light';
  return `${baseClass} ${themeSuffix}:${baseClass}`;
};