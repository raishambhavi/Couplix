// Merges app.json with EAS project id (Expo push + `eas build`).
// Override with EXPO_PUBLIC_EAS_PROJECT_ID if you ever point at another Expo project.
const EAS_PROJECT_ID = '0f733b6c-72a6-422b-acb9-e8a388f0ac03';

const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      eas: {
        ...(appJson.expo.extra?.eas || {}),
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || EAS_PROJECT_ID,
      },
    },
  },
};
