================================================================================
                    COLIBRISM - ALLE PROFILE API ENDPOINTS
================================================================================

AUTHENTIFIZIERUNG
-----------------
Alle Endpoints erfordern einen Bearer Token im Header:

    Authorization: Bearer {access_token}

Rate-Limit: 60 Anfragen pro Minute


================================================================================
                    !!! WICHTIG - AUTH ENDPOINTS !!!
================================================================================

ACHTUNG: Es gibt KEINEN /auth/user Endpoint!
Die User-Daten kommen über /api/bootstrap/bootstrap

0. LOGIN - TOKEN ERHALTEN
-------------------------
   Endpoint:    POST /api/sanctum/token
   Auth:        KEINE (public)

   Body (JSON):
   {
     "email": "deine@email.com",
     "password": "dein_passwort",
     "device_name": "MeineApp"
   }

   Response:
   "1|abc123xyz..."   <-- Das ist dein Bearer Token!

   Beispiel:
   curl -X POST "https://uservault.net/api/sanctum/token" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{"email":"test@test.com","password":"123456","device_name":"MyApp"}'


0b. EIGENE USER-DATEN ABRUFEN (nach Login)
------------------------------------------
   Endpoint:    GET /api/bootstrap/bootstrap
   Auth:        Bearer Token REQUIRED

   Beispiel:    GET /api/bootstrap/bootstrap

   Response:
   {
     "status": "success",
     "data": {
       "version": "4.0.0",
       "name": "Colibrism",
       "author": { ... },
       "auth": {
         "status": true,
         "user": {
           "id": 123,
           "name": "Max Mustermann",
           "username": "1",
           "avatar_url": "https://...",
           "cover_url": "https://...",
           "first_name": "Max",
           "last_name": "Mustermann",
           "caption": "Bio...",
           "has_tips": false,
           "tips": null,
           "is_master_account": false,
           "is_author": false,
           "verification": {
             "status": false,
             "date": null
           },
           "meta": {
             "is_admin": false
           }
         }
       }
     }
   }

   CODE-BEISPIEL (JavaScript):
   ---------------------------
   const response = await fetch('https://uservault.net/api/bootstrap/bootstrap', {
     headers: {
       'Authorization': `Bearer ${token}`,
       'Accept': 'application/json'
     }
   });
   const data = await response.json();

   // User-Daten extrahieren:
   const userId = data.data.auth.user.id;
   const username = data.data.auth.user.username;
   const name = data.data.auth.user.name;
   const avatarUrl = data.data.auth.user.avatar_url;


0c. LOGOUT
----------
   Endpoint:    POST /api/auth/logout
   Auth:        Bearer Token REQUIRED

   Response:
   {
     "status": "success",
     "message": "Logged out successfully"
   }


================================================================================
                         HAUPT-PROFIL ENDPOINTS
================================================================================

1. PROFIL NACH USERNAME ABRUFEN
-------------------------------
   Endpoint:    GET /api/profile
   Parameter:   id (string, required) - Username OHNE @ Symbol
   Regex:       ^[a-zA-Z0-9._]+$

   Beispiel:    GET /api/profile?id=1
   Beispiel:    GET /api/profile?id=crck2rich

   Response:
   {
     "status": "success",
     "data": {
       "id": 123,
       "name": "Max Mustermann",
       "first_name": "Max",
       "last_name": "Mustermann",
       "username": "1",
       "caption": "Bio kurz",
       "avatar_url": "https://...",
       "cover_url": "https://...",
       "profile_url": "https://...",
       "category": "...",
       "bio": "Längere Bio",
       "join_date": { "raw": 1234567890, "formatted": "Jan 2024" },
       "gender": "male",
       "website": "https://...",
       "verified": true,
       "publications_count": { "raw": 50, "formatted": "50" },
       "followers_count": { "raw": 1000, "formatted": "1K" },
       "following_count": { "raw": 500, "formatted": "500" },
       "meta": {
         "is_owner": false,
         "permissions": {
           "can_sanction": false,
           "can_follow": true,
           "can_mention": true,
           "can_message": true,
           "can_block": true,
           "can_report": true,
           "can_mute": true
         },
         "following": false,
         "followed_by": false,
         "requested": false,
         "requested_by": false
       }
     }
   }


2. EIGENES PROFIL ABRUFEN (BOOTSTRAP)
-------------------------------------
   Endpoint:    GET /api/bootstrap/bootstrap
   Parameter:   keine

   Beispiel:    GET /api/bootstrap/bootstrap

   Response enthält:
   - App-Version, Name, Author-Info
   - Auth-Status
   - Eigene User-Daten (wenn eingeloggt):
     - id, name, avatar_url, cover_url
     - first_name, last_name, caption, username
     - verification_status, is_master, is_author


3. PROFIL-POSTS ABRUFEN
-----------------------
   Endpoint:    GET /api/profile/posts
   Parameter:
     - id (integer, required) - User ID (NICHT Username!)
     - filter[type] (string, required) - "posts", "media", oder "activity"
     - filter[cursor] (integer, optional) - Pagination Cursor

   Beispiel:    GET /api/profile/posts?id=123&filter[type]=posts


4. PROFIL-DETAILS ABRUFEN
-------------------------
   Endpoint:    GET /api/profile/details
   Parameter:   id (integer, required) - User ID

   Beispiel:    GET /api/profile/details?id=123

   Response:
   {
     "status": "success",
     "data": {
       "info": {
         "join_date": "...",
         "gender": "...",
         "last_active": "...",
         "website": "...",
         "location": "...",
         "birthdate": "...",
         "age": 25
       },
       "contacts": {
         "phone": "...",
         "email": "..."
       },
       "social_links": [
         {
           "url": "https://...",
           "platform": "twitter",
           "name": "Twitter",
           "icon_url": "https://..."
         }
       ]
     }
   }


5. FOLLOWER ABRUFEN
-------------------
   Endpoint:    GET /api/profile/followers
   Parameter:
     - id (integer, required) - User ID
     - cursor (integer, optional) - Pagination, default 0
     - only_verified (boolean, optional) - Nur verifizierte

   Beispiel:    GET /api/profile/followers?id=123&cursor=0

   Response: 30 Follower pro Seite


6. FOLLOWING ABRUFEN
--------------------
   Endpoint:    GET /api/profile/followings
   Parameter:
     - id (integer, required) - User ID
     - cursor (integer, optional) - Pagination, default 0
     - only_verified (boolean, optional) - Nur verifizierte

   Beispiel:    GET /api/profile/followings?id=123


================================================================================
                         FOLLOW/UNFOLLOW ENDPOINTS
================================================================================

7. NUTZER FOLGEN
----------------
   Endpoint:    POST /api/follows/follow/user
   Parameter:   id (integer, required) - User ID zum Folgen

   Body:        { "id": 123 }

   Response: Relationship-Status (following, requested)


8. FOLLOW-ANFRAGE AKZEPTIEREN
-----------------------------
   Endpoint:    POST /api/follows/accept/user
   Parameter:   id (integer, required) - User ID

   Body:        { "id": 123 }


================================================================================
                         SUCHE & ENTDECKEN ENDPOINTS
================================================================================

9. NUTZER SUCHEN (EXPLORE)
--------------------------
   Endpoint:    POST /api/explore/people
   Parameter:
     - filter[query] (string, optional) - Suchbegriff
     - filter[page] (integer, optional) - Seitennummer

   Body:        { "filter": { "query": "max", "page": 1 } }

   Sucht in: name, username, city, caption, bio


10. NUTZER SUCHEN (MENTIONS/AUTOCOMPLETE)
-----------------------------------------
    Endpoint:    POST /api/autocompletes/mentions
    Parameter:   query (string, required) - Min 2, Max 255 Zeichen

    Body:        { "query": "max" }

    Response: Max 50 Nutzer mit id, username, name, avatar_url, caption


11. POSTS ENTDECKEN
-------------------
    Endpoint:    POST /api/explore/posts
    Parameter:
      - filter[page] (integer, optional, default 1)
      - filter[onset] (integer, optional) - Cursor für Pagination

    Body:        { "filter": { "page": 1 } }


12. FOLLOW-EMPFEHLUNGEN
-----------------------
    Endpoint:    GET /api/recommendations/follow
    Parameter:   limit (integer, optional) - Anzahl Empfehlungen

    Beispiel:    GET /api/recommendations/follow?limit=10


================================================================================
                         ACCOUNT SETTINGS ENDPOINTS
================================================================================

13. ACCOUNT-EINSTELLUNGEN ABRUFEN
---------------------------------
    Endpoint:    GET /api/settings/account/settings


14. ACCOUNT AKTUALISIEREN
-------------------------
    Endpoint:    PUT /api/settings/account/update
    Body:        { ... Account-Daten ... }


15. AVATAR ÄNDERN
-----------------
    Endpoint:    POST /api/settings/account/avatar/update
    Body:        multipart/form-data mit Bild


16. COVER-BILD ÄNDERN
---------------------
    Endpoint:    POST /api/settings/account/cover/update
    Body:        multipart/form-data mit Bild


17. SOCIAL SETTINGS ABRUFEN
---------------------------
    Endpoint:    GET /api/settings/social/settings


18. SOCIAL SETTINGS AKTUALISIEREN
---------------------------------
    Endpoint:    PUT /api/settings/social/update


19. PERSÖNLICHE INFOS ABRUFEN
-----------------------------
    Endpoint:    GET /api/settings/personal/settings


20. AUTHORSHIP SETTINGS
-----------------------
    Endpoint:    GET /api/settings/authorship/settings
    Endpoint:    POST /api/settings/authorship/request


21. LINKED ACCOUNTS
-------------------
    Endpoint:    GET /api/settings/account/linked
    Endpoint:    POST /api/settings/account/switch


22. THEME UPDATE
----------------
    Endpoint:    PUT /api/settings/account/theme/update


23. ACCOUNT LÖSCHEN
-------------------
    Endpoint:    DELETE /api/settings/account/delete


================================================================================
                         ADMIN ENDPOINTS
================================================================================

24. PROFIL LÖSCHEN (NUR ADMIN)
------------------------------
    Endpoint:    DELETE /api/admin/profile/delete


================================================================================
                         WICHTIGE HINWEISE
================================================================================

FEHLER BEI "username@1" oder "@1":
----------------------------------
Der Endpoint /api/profile erwartet den Username OHNE @ Symbol!

FALSCH:  ?id=@1
FALSCH:  ?id=@username1
FALSCH:  ?id=username@1
RICHTIG: ?id=1
RICHTIG: ?id=username1
RICHTIG: ?id=crck2rich

Der Username darf nur enthalten: a-z, A-Z, 0-9, Punkt (.), Unterstrich (_)


USER ID vs USERNAME:
--------------------
- /api/profile              -> nutzt USERNAME (string) z.B. "1" oder "crck2rich"
- /api/profile/posts        -> nutzt USER ID (integer) z.B. 123
- /api/profile/details      -> nutzt USER ID (integer)
- /api/profile/followers    -> nutzt USER ID (integer)
- /api/profile/followings   -> nutzt USER ID (integer)

WICHTIGER WORKFLOW:
-------------------
1. Nach Login: GET /api/bootstrap/bootstrap
   -> Gibt dir deine eigene User ID und Username

2. Um ein anderes Profil zu laden:
   a) GET /api/profile?id={username} (ohne @)
      -> Response enthält User ID
   
   b) Mit der User ID weitere Daten laden:
      - GET /api/profile/posts?id={userId}&filter[type]=posts
      - GET /api/profile/details?id={userId}
      - GET /api/profile/followers?id={userId}
      - GET /api/profile/followings?id={userId}

3. Um dein eigenes Profil zu laden:
   - Nutze deine User ID aus /api/bootstrap/bootstrap
   - Oder nutze deinen Username für /api/profile?id={username}


PAGINATION:
-----------
- Follower/Following: cursor-basiert, 30 pro Seite
- Posts: cursor-basiert mit filter[cursor]
- Explore: page-basiert


================================================================================
                         VOLLSTÄNDIGES LOGIN-BEISPIEL
================================================================================

// 1. Login
const loginResponse = await fetch('https://uservault.net/api/sanctum/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify({
    email: 'deine@email.com',
    password: 'dein_passwort',
    device_name: 'MyApp'
  })
});
const token = await loginResponse.text(); // z.B. "1|abc123..."

// 2. Eigene User-Daten abrufen
const bootstrapResponse = await fetch('https://uservault.net/api/bootstrap/bootstrap', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
const userData = await bootstrapResponse.json();
const myUserId = userData.data.auth.user.id;
const myUsername = userData.data.auth.user.username;

// 3. Eigenes Profil mit allen Details laden
const profileResponse = await fetch(`https://uservault.net/api/profile?id=${myUsername}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
const profileData = await profileResponse.json();

// 4. Eigene Posts laden
const postsResponse = await fetch(`https://uservault.net/api/profile/posts?id=${myUserId}&filter[type]=posts`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
const posts = await postsResponse.json();


================================================================================
                         CURL-BEISPIELE
================================================================================

# Login
curl -X POST "https://uservault.net/api/sanctum/token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"test@test.com","password":"123456","device_name":"MyApp"}'

# Bootstrap (eigene Daten)
curl -X GET "https://uservault.net/api/bootstrap/bootstrap" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"

# Profil nach Username (OHNE @)
curl -X GET "https://uservault.net/api/profile?id=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"

# Posts eines Users
curl -X GET "https://uservault.net/api/profile/posts?id=123&filter[type]=posts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"

# Follower abrufen
curl -X GET "https://uservault.net/api/profile/followers?id=123&cursor=0" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"


================================================================================
                         QUELLDATEIEN
================================================================================

Die Endpoints sind definiert in:
- /routes/api/user/profile.php
- /routes/api/user/follows.php
- /routes/api/user/explore.php
- /routes/api/user/bootstrap.php
- /routes/api/user/autocompletes.php
- /routes/api/user/recommend.php
- /routes/api/user/admin.php
- /routes/api/user/account_settings.php
- /routes/api.php

Controller in:
- /app/Http/Controllers/Api/User/Profile/ProfileController.php
- /app/Http/Controllers/Api/User/Follows/FollowsController.php
- /app/Http/Controllers/Api/User/Explore/ExploreController.php
- /app/Http/Controllers/Api/User/Bootstrap/BootstrapController.php
- /app/Http/Controllers/Api/User/Search/AutocompleteController.php
- /app/Http/Controllers/Api/User/Settings/AccountSettingsController.php

================================================================================
