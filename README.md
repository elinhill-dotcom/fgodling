# Systrarna Hills Odling (Canva-stil + Firebase)

Detta är din Canva-design, men med Firebase Firestore istället för Canva dataSdk.

## Viktigt: Firestore Rules (öppen, utan inloggning)
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

## Var sparas datan?
`diaries/fgs-elin-louise/records`

## Deploy
- Lägg filerna i repo-root på GitHub
- Deploya på Vercel (Framework: Other)



## Firebase Storage Rules (öppen, utan inloggning)
I Firebase → Storage → Rules:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```
