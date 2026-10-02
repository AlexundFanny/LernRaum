# LernRaum Protokoll

Verwaltungs- und Protokoll-App für ein Lerninstitut (zwei Standorte).
Lehrkräfte führen Protokolle zu ihren Einheiten, Admins verwalten Schüler,
Einheiten, Team und Finanzen.

Dies ist die neu aufgebaute, lesbare Fassung der App: sauberer Quellcode
(Vite + React + TypeScript + Tailwind), anstelle des früheren
Google-AI-Studio-Builds. Das Verhalten entspricht der bisherigen App, mit
einigen behobenen Fehlern und neuen Funktionen (siehe CHANGELOG unten).

## Technik

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS** (aus dem Build, nicht mehr per CDN)
- **Supabase** (Auth + Postgres) als Backend
- Hosting: **Netlify**

## Lokale Entwicklung

```bash
npm install          # Abhängigkeiten installieren
cp .env.example .env # Zugangsdaten eintragen (siehe unten)
npm run dev          # Entwicklungsserver (http://localhost:5173)
npm run build        # Produktions-Build nach dist/
npm run preview      # Build lokal ansehen
npm run typecheck    # Nur TypeScript prüfen
```

## Zugangsdaten (.env)

Die App liest die Supabase-Zugangsdaten aus Umgebungsvariablen:

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Zu finden im Supabase-Dashboard unter *Project Settings → API*.
Der Anon-Key ist für den Browser bestimmt und darf öffentlich sein; der
Datenschutz liegt in den Row-Level-Security-Regeln der Datenbank.

Auf Netlify werden dieselben beiden Variablen unter
*Site configuration → Environment variables* hinterlegt.

## Projektstruktur

```
src/
  main.tsx                  Einstiegspunkt
  App.tsx                   Rahmen: Auth-Status, Sidebar, Rollenumschaltung
  types.ts                  Typen aller Datenbanktabellen
  constants.ts              Fächer, Standorte, Standardzeiten, Honorarsatz
  lib/
    supabase.ts             Supabase-Client (aus .env)
    helpers.ts              Datum/Zeit, CSV-Export, Beschriftungen
  components/
    AuthScreen.tsx          Login, Registrierung, Passwort vergessen
    TeacherDashboard.tsx    Stundenplan, Protokollliste, Vertretungsbörse
    TeacherFees.tsx         Honorarübersicht (Lehrer)
    Messages.tsx            Mitteilungen
    ProtocolModal.tsx       Protokoll erfassen/bearbeiten
    StudentHistoryModal.tsx Verlauf eines Schülers
    Modal.tsx, Badges.tsx   Gemeinsame UI-Bausteine
    admin/
      AdminPanel.tsx        Fünf Tabs: Einheiten, Schüler, Team, Protokolle, Finanzen
      SessionPlannerModal.tsx  Einheit planen (inkl. Serien, Standardzeiten)
      StudentFormModal.tsx     Schüler anlegen/bearbeiten
```

## Datenbank-Sicherheit

Das Verzeichnis `db/` enthält `security_policies.sql` — das Skript, das die
Row-Level-Security-Regeln absichert (Admin-Schutz, Einladungen, Mitteilungen,
Registrierungs-Trigger). Es wurde im Supabase SQL Editor bereits ausgeführt
und ist hier zur Nachvollziehbarkeit abgelegt.

## CHANGELOG (gegenüber dem alten Build)

Behoben:
- Monatsfilter in Finanzen/Honorar verschob Protokolle vom Monatsletzten in
  den Folgemonat (Zeitzonen-Umrechnung). Jetzt korrekt über lokale Datumsgrenzen.
- Jahresauswahl war fest 2024–2026; jetzt dynamisch bis zum Folgejahr.
- "Verspätet"/"Entschuldigt" wurden in Liste und CSV als "Fehlt" angezeigt.
- "Offen"-Zähler bezog zukünftige Einheiten ein; jetzt nur vergangene/heutige
  ohne Protokoll.
- Tailwind kommt aus dem Build statt per CDN; Supabase-Daten aus .env statt
  fest im Code; Honorarsatz zentral in einer Konstante.

Neu:
- Standardzeiten als Schnellwahl im Einheiten-Planer (3 Blöcke à 100 Min.).
- Schulstufe wird neben den Schülernamen im Stundenplan angezeigt.
- Serien bekommen eine `series_id` (Grundlage für spätere Serien-Bearbeitung).
- Super-Admins sind gegen versehentliches Löschen geschützt; Admin-Rechte
  lassen sich nur von Super-Admins vergeben.
