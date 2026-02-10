# Splitly Mobile

A React Native mobile app for splitting expenses built with Expo.

## Prerequisites

- Node.js installed
- Expo Go app installed on your iPhone (available on the App Store)
- Your iPhone and computer on the same Wi-Fi network

## Getting Started

### 1. Install Dependencies

```bash
cd SplitlyMobile
npm install --legacy-peer-deps
```

### 2. Start the Development Server

```bash
npm start
```

This will start the Expo development server and show a QR code in your terminal.

### 3. Connect Your iPhone

1. Open the **Expo Go** app on your iPhone
2. Scan the QR code displayed in your terminal
3. The app will load on your device

## Features

- ✅ Create and manage groups
- ✅ Add members to groups
- ✅ Track expenses
- ✅ Automatic balance calculations
- ✅ Simplified debt settlements
- ✅ Persistent storage with AsyncStorage

## Project Structure

```
SplitlyMobile/
├── App.tsx                 # Main app component
├── src/
│   ├── screens/           # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── GroupDetailScreen.tsx
│   │   ├── AddGroupScreen.tsx
│   │   └── AddExpenseScreen.tsx
│   ├── navigation/        # Navigation setup
│   │   └── AppNavigator.tsx
│   ├── store/            # Zustand state management
│   │   └── index.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   └── lib/              # Utility functions
│       ├── calculations.ts
│       └── utils.ts
└── package.json
```

## Technologies

- **Expo** - React Native framework
- **React Navigation** - Navigation library
- **Zustand** - State management
- **TypeScript** - Type safety
- **AsyncStorage** - Local data persistence
- **date-fns** - Date formatting

## Troubleshooting

### QR Code Not Working

If the QR code doesn't work:
1. Make sure your phone and computer are on the same Wi-Fi network
2. Try typing the URL manually in Expo Go
3. Restart the development server with `npm start`

### App Not Loading

- Check that all dependencies are installed
- Try clearing the Expo cache: `npx expo start -c`
- Make sure you're running the latest version of Expo Go on your iPhone

## Development

The app uses hot reloading, so any changes you make to the code will automatically refresh on your device.

To restart the app, shake your iPhone and select "Reload" from the developer menu.
