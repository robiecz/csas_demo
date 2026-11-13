# Kolo štěstí — demo.minka.cz

Samostatná responzivní aplikace bez npm závislostí. Node.js 22+, nebo Docker Compose. Správa jmen a losování vyžadují heslo; veřejná stránka zobrazuje účastníky a historii. Každý aktivní účastník má stejnou šanci (`crypto.randomInt`). Přibližně 30 % losování má dramatické dokončení. Zvuk vytváří Web Audio, nejsou potřeba externí služby ani zvukové soubory.

## Lokálně

1. `cp .env.example .env` a nastav dlouhé unikátní `ADMIN_PASSWORD`.
2. `npm start`
3. Otevři http://localhost:3080, přihlas se v Administraci a vlož jména.

Prázdná databáze je záměrná. Ukázková jména nejsou skuteční účastníci. Jména: každý na samostatný řádek, min. dvě slova, max. 80 znaků, nejvýše 300 osob. Stejná jména se sloučí; jmenovce rozliš dalším jménem.

## Vzdálený server

1. Nasměruj DNS A (případně AAAA) demo.minka.cz na server.
2. Nahraj projekt do samostatného adresáře, například `/opt/kolo-stesti`.
3. Připrav `.env` podle `.env.example` s unikátním heslem.
4. Spusť `docker compose up -d --build`.
5. Přidej přiložený nginx server blok k existující konfiguraci. Ověř `nginx -t` a pak reload. Pokud používáš jinou reverzní proxy, nastav demo.minka.cz → http://127.0.0.1:3080.
6. Pro HTTPS použij stávající správu certifikátů, např. `certbot --nginx -d demo.minka.cz`. Administraci používej pouze přes HTTPS.

Nevyměňuj konfiguraci ostatních aplikací. Soubor nginx.conf je samostatný virtuální server. Nasazení se musí přizpůsobit existující konfiguraci BikeRide; přístup k tomuto serveru zatím není součástí projektu.

## Data a obsluha

Stav se atomicky ukládá do `data/state.json`, v Dockeru do persistentního volume `kolo-data`. Zálohuj tento soubor / volume. Nepoužívej `docker compose down -v`, pokud chceš data zachovat. Reset maže historii vítězů a vrací všechny do hry, nikoliv seznam jmen. Odebrání osoby nemaže její dřívější výhru.

Vítěz se uloží ještě před animací: zůstane vyřazený i při obnovení stránky nebo ztrátě spojení. Zámek 13,5 sekundy a kontrola revize chrání před souběžným losováním. Provozuj jednu instanci Node, nikoliv více replik nad stejným JSON souborem. Přihlášení zůstává jen v paměti otevřené stránky. Veřejně dostupná stránka zobrazuje celá jména; pro neveřejnou akci omez přístup na proxy.

Zvuk lze vypnout, podporován je fullscreen a omezení pohybu podle nastavení zařízení. Při velmi vysokém počtu účastníků jsou názvy na kole malé; celý seznam je dostupný vedle kola.

## Vercel + GitHub

Repozitář lze importovat do Vercelu jako framework Other. `vercel.json` nastavuje statické soubory z `public/` a API běží v Node.js Functions. Nastav Node.js 24.x a žádný build command.

Před nasazením připoj přes Vercel Marketplace samostatný Upstash Redis a nastav:

- `ADMIN_PASSWORD` — unikátní heslo pro administraci.
- `UPSTASH_REDIS_REST_URL` a `UPSTASH_REDIS_REST_TOKEN` — přidá integrace Upstash.

Pro preview používej samostatnou databázi, aby testování neměnilo ostré losování. Redis ukládá stav i zámek a atomická kontrola revize brání souběžným změnám mezi instancemi. Bez Redis se aplikace na Vercelu záměrně odmítne spustit; dočasné úložiště se pro účastníky nepoužívá. Lokální a Docker provoz nadále využívá JSON soubor.

V nastavení Domains přidej demo.minka.cz a použij přesně DNS hodnoty z Vercelu. Push do produkční větve pak spustí automatické nasazení.

## Sdílené živé losování

Server ukládá pro každý tah `currentDraw`: identifikátor, serverový čas začátku, fáze animace, okamžik rozsvícení a vyhlášení i výsledný úhel. Prohlížeče používají stejnou funkci `sampleDraw` z `public/timeline.js` a čas korigovaný podle odpovědí serveru. Pozdější divák vstoupí do aktuální fáze; animace se mu nespouští od začátku. Výherce se na stránce zobrazí až v čase vyhlášení.

Viditelné stránky kontrolují stav každých 2,5 sekundy; skryté stránky neprovádějí pravidelné dotazy a při návratu si stav okamžitě obnoví. Zjištění nového tahu nebo stisknutí Pokračovat na jiném zařízení proto může mít zpoždění přibližně do 2,5 sekundy plus doba sítě. Po připojení se samotná animace řídí společnou časovou osou. Každý stavový dotaz představuje jeden Redis GET — otevřené stránky sdílejí bezplatný limit databáze s BikeRide.

Zvuk na cizím zařízení může prohlížeč povolit až po interakci. Omezení pohybu respektujeme: čas vyhlášení zůstává společný, ale kolo se na takovém zařízení průběžně neotáčí.
