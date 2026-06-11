# OS. CNC Mechplast — Website Modul-System

## Ordnerstruktur

```
Intranet/
│
├── index.html              ← HAUPTDATEI (alles zusammen)
│
├── css/
│   └── main.css            ← Farben, Schriften, globale Styles
│
├── js/
│   ├── translations.js     ← Alle Texte in DE / IT / EN / FR
│   └── app.js              ← Sprache, Supabase, KI, Formular
│
├── modules/                ← Jedes Modul = 1 Sektion der Website
│   ├── 01_nav.html         ← Navigation
│   ├── 02_hero.html        ← Hero / Startbereich
│   ├── 03_ticker.html      ← Laufband (kann weggelassen werden)
│   ├── 04_machines.html    ← Leistungen / Maschinen
│   ├── 05_industries.html  ← Branchen / Referenzen
│   ├── 06_team.html        ← Team
│   ├── 07_contact.html     ← Kontakt + KI-Skizzenanalyse
│   └── 08_footer.html      ← Footer
│
└── README.md               ← Diese Datei
```

---

## Häufige Änderungen

### Farbe ändern
→ `css/main.css` → `--accent: #C8460A;` → Wert ersetzen

### Text ändern
→ `js/translations.js` → Texte in de / it / en / fr anpassen

### Neue Maschine hinzufügen
1. In `index.html`: eine `.machine-card` duplizieren
2. Nummer anpassen: `04 / RETTIFICA`
3. `data-key` ändern: `m4_title`, `m4_desc`, `m4_s1` usw.
4. In `js/translations.js` die neuen Keys für alle 4 Sprachen eintragen

### Neue Branche hinzufügen
1. In `index.html`: eine `.ind-card` duplizieren
2. `data-key` anpassen: `ind7_t`, `ind7_p`
3. In `js/translations.js` eintragen

### Neue Sprache hinzufügen
1. In `modules/01_nav.html`: neuen Button hinzufügen
2. In `js/translations.js`: neuen Sprachblock kopieren und übersetzen
3. In `js/app.js` → `langLabel`-Objekt ergänzen

### Modul entfernen
→ In `index.html` den entsprechenden Kommentar-Block löschen

### Ticker deaktivieren
→ In `index.html` die Ticker-Zeile löschen

### KI-Analyse deaktivieren
→ In `index.html` den `.form-group`-Block mit `uploadZone` löschen

---

## Supabase aktivieren
1. `js/app.js` öffnen
2. `CONFIG.supabaseUrl` = deine Supabase-URL
3. `CONFIG.supabaseKey` = dein anon key
→ Jede Anfrage landet automatisch in der `leads`-Tabelle

---

## Lokal testen
```bash
cd Intranet
py -m http.server 5500
# Browser: http://localhost:5500
```

## Deployen
```bash
git add Intranet/
git commit -m "Update: [Beschreibung]"
git push
# Cloudflare Pages deployt automatisch
```
