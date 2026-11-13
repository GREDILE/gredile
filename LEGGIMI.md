# GR Edile Gestionale: guida per metterlo online

Il sito è fatto di file semplici (nessuna installazione). I dati stanno su **Supabase** (gratis), il sito è pubblicato da **GitHub Pages** (gratis). Chi entra con email e password vede e modifica gli stessi dati, e le modifiche compaiono subito sugli altri dispositivi.

Servono circa 20 minuti, una sola volta.

## 1. Supabase: database e accessi

1. Crea un account su supabase.com e un **nuovo progetto** (scegli una regione europea, per esempio Francoforte). Annota la password del database, anche se qui non serve.
2. Apri **SQL Editor** > **New query**. Apri il file `supabase/schema.sql`, **cambia le due email in alto** con la tua e quella di tuo suocero, incolla tutto e premi **Run**. Deve finire senza errori.
3. Apri **Authentication** > **Users** > **Add user** > **Create new user**. Crea un utente per te e uno per tuo suocero (stessa email scritta nello schema, una password a scelta). Spunta la conferma automatica dell'email, se te la propone.
4. Nelle impostazioni di accesso con email (**Authentication** > **Sign In / Providers** > **Email**) **disattiva la registrazione di nuovi utenti**. Così nessun altro può crearsi un account. Anche se restasse attiva, il database accetta solo le email scritte nello schema.
5. Apri **Project Settings** > **API** (o **Data API**) e copia due valori: **Project URL** e la chiave **anon public**.

## 2. Collega il sito a Supabase

Apri `js/config.js` e incolla i due valori al posto di `INSERISCI-QUI-...`. La chiave *anon* è pensata per stare in un sito pubblico: i dati sono protetti dal login e dalle regole che hai creato al punto 1.

## 3. GitHub: pubblicazione

1. Crea un account su github.com e un **nuovo repository** (per esempio `gr-edile`).
2. Carica **tutti i file e le cartelle** di questo progetto (dal pulsante **Add file** > **Upload files** puoi trascinarli). Attenzione: anche la cartella nascosta `.github`, che contiene la pubblicazione automatica.
3. Vai su **Settings** > **Pages** e in **Source** scegli **GitHub Actions**.
4. Nella scheda **Actions** aspetta che "Pubblica il sito" diventi verde. L'indirizzo del sito è `https://IL-TUO-NOME.github.io/gr-edile/`.

Nota: con un account GitHub gratuito, GitHub Pages richiede un repository **pubblico**. Il codice sarà visibile, ma i dati dell'azienda no: sono su Supabase, dietro il login. Se preferisci un repository privato, Cloudflare Pages o Netlify pubblicano gratis lo stesso progetto da un repository privato (senza `.github`).

## 4. Primo uso

1. Apri l'indirizzo del sito ed entra con email e password.
2. **Impostazioni**: compila partita IVA, sede e IBAN dell'azienda.
3. Inserisci clienti e cantieri. Da telefono, usa "Aggiungi a schermata Home" per averlo come un'app.

Per cambiare qualcosa nel sito, modifica i file direttamente su GitHub (matita) o ricaricali: dopo un minuto la nuova versione è online.

## Fatture e SDI

Dalla fattura, il pulsante **Prepara XML per SDI** genera il file XML (FatturaPA). L'invio allo SDI si fa gratis dal portale **Fatture e Corrispettivi** dell'Agenzia delle Entrate (accesso con SPID, CIE o CNS del legale rappresentante) oppure dal servizio gratuito delle Camere di Commercio (InfoCamere). Una fattura non consegnata tramite SDI vale come non emessa. Fai controllare la prima fattura al commercialista, in particolare la causale della ritenuta in Impostazioni.

## Cose da sapere

- I dati sono salvati come righe JSON nella tabella `records`: va bene per una ditta con poche migliaia di documenti. Per cambiare in futuro la struttura servono nuove tabelle.
- Supabase gratuito mette in pausa i progetti inutilizzati per una settimana. Aprire il sito ogni tanto basta; se capita, si riattiva dal pannello di Supabase.
- Esegui ogni tanto un backup: **Table Editor** > `records` > **Export**.
