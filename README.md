# FGs odlingsapp

En enkel mobilvänlig odlingsdagbok som sparar allt i Firebase Firestore (utan inloggning).

## Kom igång
1. Ladda upp filerna i repo-root (GitHub).
2. Deploya på Vercel som statisk site.
3. I Firebase:
   - Firestore Database → Create database (Test mode eller öppna regler)

## Öppna Firestore-regler (om du vill köra helt öppet)
**Firestore → Rules:**
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

## Dela dagbok
I appen: "Dagbok-ID" (t.ex. `fgs-2026`). Om ni båda använder samma ID så delar ni allt.

## Var ändrar jag Firebase config?
I `app.js` högst upp.
