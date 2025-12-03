# LernRaum Protokoll

Ein Protokoll-System für Lerneinheiten mit Schüler- und Anwesenheitsverwaltung.

## 📁 Projektstruktur

```
lernraum-projekt/
├── index.html          # Hauptseite
├── css/
│   └── style.css       # Alle Styles
└── js/
    ├── utils.js        # Hilfsfunktionen & Konstanten
    ├── auth.js         # Login, Logout, Registrierung
    ├── students.js     # Schüler-Verwaltung
    ├── sessions.js     # Einheiten-Verwaltung & Wiederholungen
    ├── attendance.js   # Anwesenheits-Verwaltung
    ├── protocols.js    # Protokoll-Erstellung
    ├── schedule.js     # Lehrer-Stundenplan
    ├── teachers.js     # Benutzer-Verwaltung
    └── stats.js        # Statistiken & Daten-Export
```

## 🚀 Installation

1. **Entpacke das ZIP-Archiv** in einen Ordner
2. **Öffne index.html** im Browser

Oder für einen Webserver:
1. Lade den Ordner auf deinen Webserver hoch
2. Öffne die URL im Browser

## ✨ Features

- **Multi-Benutzer-System**: Super-Admin, Admins, Lehrer
- **Schüler-Verwaltung**: Anlegen, Bearbeiten, Status
- **Einheiten-Planung**: Einzel- und Wiederholungstermine
- **Anwesenheit**: Individuelle Erfassung pro Schüler (✅❌⏰📝)
- **24-Stunden-Sperre**: Lehrer können Anwesenheit nur 24h lang ändern
- **Protokolle**: Detaillierte Stundendokumentation
- **Monatsstatistik**: Einheiten und Stunden pro Monat
- **Daten-Export**: JSON-Backup aller Daten

## 📝 Hinweise

- Alle Daten werden im **localStorage** des Browsers gespeichert
- Der erste registrierte Benutzer wird automatisch **Super-Admin**
- Admins können zwischen Admin-Dashboard und Lehrer-Ansicht wechseln

## 🔧 Anpassungen

- **Logo**: Ersetze die Emoji-Platzhalter in index.html durch dein Logo
- **Farben**: Ändere die CSS-Variablen in style.css (`:root`)
- **Funktionen**: Erweitere die entsprechenden JS-Module

## 📱 Responsive

Die App ist für Desktop und Tablet optimiert. Auf Mobilgeräten werden einige Layouts angepasst.
