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
    TeacherDashboard.tsx    Mein Stundenplan, gemeinsamer Kalender,
                            Protokollliste, Vertretungsbörse
    TeacherFees.tsx         Honorarübersicht (Lehrer)
    Messages.tsx            Mitteilungen
    ProtocolModal.tsx       Protokoll erfassen/bearbeiten
    StudentHistoryModal.tsx Verlauf eines Schülers (inkl. Leistungen)
    Modal.tsx, Badges.tsx   Gemeinsame UI-Bausteine
    admin/
      AdminPanel.tsx        Fünf Tabs: Einheiten, Schüler, Team, Protokolle, Finanzen
      SessionPlannerModal.tsx  Einheit planen (inkl. Serien, Standardzeiten)
      StudentFormModal.tsx     Schüler anlegen/bearbeiten
```

## Datenbank-Sicherheit

Das Verzeichnis `db/` enthält die SQL-Skripte, die im Supabase SQL Editor
ausgeführt werden:

- `security_policies.sql` — sichert die Row-Level-Security ab (Admin-Schutz,
  Einladungen, Mitteilungen, Registrierungs-Trigger). Bereits ausgeführt, hier
  zur Nachvollziehbarkeit abgelegt.
- `leistungen_und_kalender.sql` — legt die Tabelle `student_assessments` an
  (Schularbeiten, Tests, Prüfungen) und erweitert das Leserecht auf
  `sessions`/`session_students`, damit Lehrer den gemeinsamen Kalender sehen.
  **Muss noch ausgeführt werden**, sonst bleiben die neuen Funktionen leer.

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

## CHANGELOG (laufend)

Neu:
- **Leistungen (SA/Test/Prüfung).** Im Protokoll gibt es pro Schüler einen
  Abschnitt für Schularbeiten, Tests und Prüfungen: Prüfungsart, Datum und
  Bewertung. Bewertet wird als Schulnote 1–5 und/oder als Symbol (+ ~ −).
  Das Datum ist frei wählbar und mit dem Datum der Einheit vorbelegt, damit
  angekündigte Schularbeiten in der Zukunft eingetragen werden können.
  Kommt zusätzlich zur laufenden Bewertung pro Einheit.
- **Prüfungstermine in der Lehreransicht.** Alle erfassten Leistungen eines
  Schülers erscheinen im Protokoll bei genau diesem Schüler — auch die, die
  ein Kollege eingetragen hat (dann nur lesbar). Ebenso im Schülerverlauf
  als eigener Block, zukünftige Termine sind als "angekündigt" markiert.
  Im CSV-Export als Spalte `Leistungen` sowie als eigener Export.
- **Gemeinsamer Kalender.** Dritter Reiter neben "Mein Stundenplan" und
  "Vertretungsbörse", auch für Lehrer. Wochenraster über alle Lehrer:
  Wochentage als Spalten, Zeilen je Standort und Zeitblock. Die Standorte
  sind eigene Zeilengruppen und blockieren sich nicht gegenseitig — eine
  Einheit in Floridsdorf belegt den Block in Wien Mitte nicht. Freie Blöcke
  bleiben einfach leer, die eigenen Einheiten sind hervorgehoben, Filter
  nach Standort. Reine Anzeige — eingeteilt und verschoben wird nur vom
  Admin.

Hinweis zu den zwei Bewertungsskalen:
- laufende Bewertung pro Einheit (`protocol_attendance.progress`):
  5 = sehr gut … 1 = schlecht
- Schulnote einer Leistung (`student_assessments.grade_number`):
  1 = Sehr gut … 5 = Nicht genügend
