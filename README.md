# FGs odlingsapp (tabeller, grön)

Mobil: scroll. Desktop: meny överst.

## Firebase
Appen sparar i Firestore utan inloggning.

### Firestore Rules (helt öppet)
Firestore → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Repo
Ladda upp allt i repo-root:
- index.html
- styles.css
- app.js
- sw.js
- manifest.webmanifest
- icons/
