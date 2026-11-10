# Orbit Calendar

App desktop per Windows in stile Notion Calendar: Electron + React + TypeScript, tema scuro/chiaro, dati salvati in locale sul PC.

## Eseguibili

Dopo `npm run dist` trovi in `release/`:

- `Orbit-Calendar-Setup-1.0.0.exe` – installer (collegamento sul desktop e nel menu Start, disinstallabile da Impostazioni → App)
- `Orbit-Calendar-Portable-1.0.0.exe` – versione portable, si avvia senza installazione

Gli exe non sono firmati digitalmente: al primo avvio Windows SmartScreen può mostrare "Il PC è stato protetto" → "Ulteriori informazioni" → "Esegui comunque".

## Sviluppo

```bash
npm install
npm run app        # compila e apre l'app desktop
npm run dist       # genera installer e portable in release/
npm run icon       # rigenera build/icon.ico da build/icon.svg (vedi scripts/make-icon.cjs)
```

Per lavorare con hot reload: `npm run dev` in un terminale e `npm run app:dev` in un altro.

I dati (eventi, calendari, impostazioni) sono in `%APPDATA%\Orbit Calendar`.

## Funzionalità

- **Viste**: giorno, 3 giorni, settimana, mese, anno (heatmap degli impegni) e agenda.
- **Drag & drop**: trascina su uno spazio vuoto per creare, trascina un evento per spostarlo, tira il bordo inferiore per ridimensionarlo. Nel mese e nella riga "Giornata" sposti gli eventi tra i giorni.
- **Linguaggio naturale** (`Ctrl K`): "Call con Luca venerdì dalle 15 alle 16:30 #lavoro @ Ufficio", "Palestra ogni martedì alle 19 per 1h", "Ferie 12/08 tutto il giorno".
- **Command palette**: cerca eventi, cambia vista, esegue comandi.
- **Inbox attività**: aggiungi attività ("Report 45m !"), trascinale nel calendario oppure lascia che "Auto" le inserisca negli slot liberi.
- **Proteggi tempo focus**: aggiunge blocchi focus fino a 2 ore nei buchi più grandi della settimana.
- **Condividi disponibilità**: selezioni gli slot (o li auto-compili) e copi un testo pronto da incollare.
- **Analisi del tempo**: ore pianificate, riunioni, focus, carico giornaliero, ripartizione per calendario e suggerimenti.
- **Prossimo evento**: conto alla rovescia, avanzamento dell'evento in corso, pulsante "Partecipa" per Meet/Zoom/Teams e tempo libero rimasto oggi.
- Barra del titolo integrata nel tema, notifiche di Windows 5 minuti prima di ogni evento, finestra che ricorda posizione e dimensioni.
- Eventi ricorrenti (modifica di un solo evento o di tutta la serie), conflitti evidenziati, secondo fuso orario, festività italiane, Ctrl+Z, import/export `.ics`.

## Scorciatoie

| Tasto | Azione |
|---|---|
| `C` | Nuovo evento |
| `Ctrl K` / `/` | Cerca o crea |
| `T` | Oggi |
| `J` `K` / `→` `←` | Periodo successivo / precedente |
| `D` `3` `W` `M` `Y` `A` | Giorno, 3 giorni, settimana, mese, anno, agenda |
| `S` | Condividi disponibilità |
| `I` | Analisi del tempo |
| `F` | Proteggi tempo focus |
| `Ctrl D` / `Canc` | Duplica / elimina l'evento selezionato |
| `Ctrl Z` | Annulla |
| `[` | Barra laterale |
| `?` | Tutte le scorciatoie |

## Struttura

- `src/lib/`: logica pura (date, ricorrenze, layout degli eventi, parser NLP italiano, .ics, scheduling)
- `src/store/`: stato globale (zustand, persistito) e dati demo
- `src/components/`: interfaccia (viste, sidebar, pannelli, palette, modali)
