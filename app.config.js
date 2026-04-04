// Merges app.json with env-driven EAS project id (required for Expo push tokens).
// Set EXPO_PUBLIC_EAS_PROJECT_ID after running `eas init` or from the Expo dashboard.
const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '',
      },
    },
  },
};
