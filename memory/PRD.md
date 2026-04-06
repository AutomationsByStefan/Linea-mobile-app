# Linea Pilates - Expo React Native Mobile App

## Overview
Mobile application for "Linea Pilates" Reformer Pilates studio in Trebinje, BiH. Connects to existing backend API. Client-facing screens only (no admin panel).

## Architecture
- **Frontend**: Expo SDK 54 (React Native) with expo-router file-based navigation
- **Backend Proxy**: FastAPI (server.py) acts as reverse proxy to external API at `https://pilates-studio-19.preview.emergentagent.com`
- **External API**: Existing Pilates studio backend providing all business logic and data
- **Auth**: Phone + PIN session-based authentication (cookies proxied through backend)

## Design System
- Background: #FDFCF8 (warm cream)
- Primary/Gold: #A68B5B
- Fonts: Playfair Display (headings), Manrope (body text)
- Cards: 24px border radius, subtle gold shadows
- Buttons: Pill shape (9999 radius), 48px height
- All text in Bosnian language

## Screens (13 total)
1. **Login** (`/(auth)/login`) - Phone + country code dropdown, PIN entry step
2. **Registration** (`/(auth)/register`) - Name, email, PIN fields
3. **Home** (`/(tabs)/`) - Hero card, memberships, trainings, contact info, feedback modal
4. **Schedule** (`/(tabs)/termini`) - Date strip, time slots grid, booking confirmation
5. **Packages** (`/(tabs)/paketi`) - Package cards with badges, request flow
6. **Profile** (`/(tabs)/profil`) - Stats, membership status, menu navigation
7. **Training History** (`/treninzi`) - Upcoming/past tabs with comments
8. **Weight Tracking** (`/tezina`) - SVG line chart, entry management
9. **Notifications** (`/obavjestenja`) - Read/unread states, mark all
10. **Memberships** (`/clanarine`) - Active/expired membership overview
11. **Invite** (`/pozivnica/[inviteId]`) - Deeplink invite acceptance

## Key Files
- `src/api.ts` - API client with proxy support
- `src/theme.ts` - Design system constants
- `src/context/AuthContext.tsx` - Auth state management
- `src/components/CountryPicker.tsx` - Country code selector
- `src/components/FeedbackModal.tsx` - Training feedback
- `backend/server.py` - Reverse proxy to external API

## External API Base
`https://pilates-studio-19.preview.emergentagent.com/api`

## Notes
- Google login deferred to v2
- Google Maps uses static link (opens Maps app)
- No backend/database development needed (existing API)
