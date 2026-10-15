# PWA Icons Setup

## Current Status
The app is now configured as a PWA! However, you need to generate proper icon files.

## Required Icons
- `pwa-192x192.png` - 192x192px icon
- `pwa-512x512.png` - 512x512px icon
- `apple-touch-icon.png` - 180x180px icon (for iOS)
- `favicon.ico` - 32x32px favicon

## Quick Icon Generation
Use one of these methods:

### Method 1: Online Tools (Easiest)
1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload your logo (square, at least 512x512px)
3. Download the generated icon pack
4. Replace the placeholder files in `frontend/public/` folder

### Method 2: Using icon.svg
1. Install ImageMagick or use an online SVG to PNG converter
2. Convert `icon.svg` to the required sizes:
   - 192x192px → pwa-192x192.png
   - 512x512px → pwa-512x512.png
   - 180x180px → apple-touch-icon.png

### Method 3: Manual Creation
1. Create square PNG images in your favorite design tool
2. Export at the required sizes listed above
3. Replace the placeholder files

## Testing PWA
After deploying with proper icons:
1. Open the app in Chrome/Edge on mobile
2. You'll see an "Install" or "Add to Home Screen" prompt
3. Install the app
4. The app will work offline and launch like a native app!

## Features Enabled
✅ Install to home screen
✅ Offline support (caches static assets)
✅ Auto-updates when new version is deployed
✅ Splash screen on mobile
✅ Native app-like experience
