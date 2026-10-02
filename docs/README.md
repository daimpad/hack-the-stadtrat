# Dokumentation

Grundlage der Seite `002-neon-rain.html` (Mitmach-Tag „Hack den Stadtrat“, 17. Oktober 2026).

| Datei | Inhalt |
| --- | --- |
| `002-neon-rain-bonn-prompt-v2.txt` | Exakt verwendeter Prompt v2 mit dem Block INHALTE (wörtlich übernommene Veranstaltungsangaben), Beschreibung, Techniken und Interaktionsmodell |
| `audit-transformation-v1.tsv` | Änderungen vom generischen Original (District 9 Night Market) zur fiktiven Bonner Szene |
| `audit-transformation-v2.tsv` | Änderungen von der eigenständigen Szene (v1) zur Veranstaltungsseite (v2) |

Spätere Änderungen gegenüber Prompt v2 (Katzenkopf statt Beethoven-Büste, bewegter Hintergrund der Abschnitte, Kalenderdatei, CTA am Seitenende, kein Fiktionshinweis im Footer, URL `https://code.paderta.com/hack-den-stadtrat/`) sind in den Pull Requests des Repositorys beschrieben.

## Weitere Dateien im Repository

- `tests/smoke.cjs`, `.htmlvalidate.json`: automatische Prüfung bei Pull Requests (`.github/workflows/check.yml`)
- `plakat/build.cjs`: erzeugt das A3-Plakat aus der Seite (`node plakat/build.cjs`)
