# SchoolTracker (React Edition)

Diese Version des SchoolTrackers basiert vollständig auf React und wird mit [Vite](https://vitejs.dev/) entwickelt. Das Dashboard kombiniert Uhrzeit, Wetter, Schultags-Countdown und Schuljahresfortschritt in einer modernen Oberfläche.

## Projektstruktur

```
SchoolTracker/
├── frontend/         # React + Vite Anwendung
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       └── main.jsx
├── .github/workflows/deploy.yml  # GitHub Actions Workflow für Auto-Deploy
└── README.md
```

## Entwicklung lokal starten

```bash
cd frontend
npm install
npm run dev
```

Vite startet anschließend den Dev-Server (standardmäßig auf `http://localhost:5173`).

## Produktion bauen

```bash
cd frontend
npm install
npm run build
```

Der gebaute Output liegt anschließend in `frontend/dist/`.

## Automatisches Deployment

Der Workflow in `.github/workflows/deploy.yml` baut die Anwendung auf jedem Push nach `main` und deployed sie via GitHub Pages. Voraussetzungen:

1. In den Repository-Settings GitHub Pages auf „GitHub Actions“ stellen.
2. Erster erfolgreicher Lauf des Workflows – danach ist die Seite über die von GitHub bereitgestellte URL erreichbar.

## Features

- Live-Uhr und Datumsanzeige (deutsche Lokalisierung).
- Wetterdaten (Open-Meteo API) inklusive gefühlter Temperatur, Regenwahrscheinlichkeit, Wind, Luftfeuchtigkeit, Tageshöchst-/Tiefstwert, Sonnenauf- und -untergang.
- Schultagsring mit Countdown und Halbkreis-Modus.
- Schuljahresfortschritt (08.09 – 30.04) mit Resttagen und Reststunden.
- Dark-/Light-Theme, Temperatur-Einheitenumschaltung und Stadt-Suche – Einstellungen werden in `localStorage` persistiert.
