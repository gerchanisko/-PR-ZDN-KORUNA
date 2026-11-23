# PRÁZDNÁ KORUNA (Hollow Crown)

Kompletní 3D hororová hra ve stylu **weirdcore + retro fantasy + PS1**: hub, 3 levely, boss a 3 konce.
Zapneš „fantasy hru z roku 1998“. Menu je rozbité, jde jen *Načíst hru* a na paměťové kartě je jediná pozice: **NEHRÁT ZNOVU**.

Všechno — textury, modely, zvuky i hudba — se generuje kódem při spuštění. Nic se nestahuje.

## Spuštění (jeden příkaz)

```sh
npm start
```

Otevře hru v okně Chromia (`--app` režim, bez lišt). Potřebuješ jen **Node.js 18+** a prohlížeč s WebGL2
(Chromium/Chrome/Brave; jinak se otevře Firefox nebo výchozí prohlížeč). Three.js je přibalené v `lib/`,
takže `npm install` není potřeba pro hraní — jen pro automatické testy.

Bez Node: `python3 -m http.server 8047` v této složce a otevři `http://127.0.0.1:8047/`.

## Ovládání

Hra je ve **first person** (styl PS1 dungeonů typu King's Field). Klávesou **V** se dá kdykoli přepnout
na původní **fixní kamery s tank controls** (volba se pamatuje).

| Akce | Klávesa | Gamepad |
|---|---|---|
| Dopředu / dozadu | W S nebo ↑ ↓ | D-pad / levá páčka |
| Otáčení | ← → nebo myš (klikni do okna) | D-pad / levá páčka |
| Úkrok do strany | A D (jen first person) | — |
| Běh | Shift (držet) | X / RT |
| Otočka o 180° | Q nebo X | B |
| Akce / mluvit / potvrdit | E, Enter nebo Mezerník | A |
| Inventář a mapa | Tab nebo I | Start / Y |
| Přepnout pohled (1. osoba ↔ fixní kamery) | V | — |
| Pauza / zpět / zavřít | Esc (uvolní i myš) | Select |
| Ztlumit zvuk | M | — |

Při rozhovoru s králem a pekařem, ve skříni a ve vzpomínce přebírá kameru scéna.

## Co je ve hře

Mapa a propojení místností jsou v **[MAP.md](MAP.md)**.

1. **Rozbité menu** — „Nová hra“ hlásí chybu, „Nastavení“ je NENAČTENO, na kartě je jen save „NEHRÁT ZNOVU“.
2. **Nádvoří Ardemooru (hub)** — král Oswin (jen titulky, žádný zvuk), pekař Bořek, strážní v T-pose, troje dveře a čtvrté, které jsou zatím jen na mapě.
3. **Level 1: Nekonečná kuchyně / zbrojnice** — smyčka, hádanka se sporákem, klíč z trouby, Kabát.
4. **Level 2: Kostel pod vodou** — slepý Zvoník, který slyší kroky; zvony v pořadí čísel písní.
5. **Level 3: Školní chodba, která končí trůnním sálem** — Učitelka bez obličeje, zámek na skříňce, propustka.
6. **Boss „Ten, kdo čeká“** — loading bar na 99 %, který ohýbá prostor. Nezabíjí se: hádanka a rozhodnutí.
7. **Save systém** — každé uložení smaže jednu vzpomínku jednoho NPC (pekař zapomene dceru, pak přijde o obličej, …).
8. **Falešné systémové hlášky** („Memory card full“, „Ovladač odpojen“) v nejhorší chvíli; glitche, zamrznutí, restart místnosti.
9. **3 konce** — dohraješ hru / vypneš konzoli / secret (jak na něj, je ve hře naznačené a v MAP.md).

Délka: zhruba 45–60 minut.

## Technika

- **Three.js + vlastní GLSL shadery** (`src/engine/ps1.js`): render do 320×240, nearest-neighbor zvětšení, vertex snapping,
  afinní mapování textur (trik `uv·w / w`), Gouraud osvětlení po vrcholech, mlha jako draw distance,
  „stipple“ průhlednost, post-proces s Bayer ditheringem a 15bit barvou, trhání obrazu, RGB posun, šum, zamrznutí.
- **Textury** (`src/assets/textures.js`): Canvas 2D, 8–128 px, poškozené škrábanci a „vadnými sektory“,
  prohnané **skutečným JPEG enkodérem** prohlížeče a kvantizované. Slunce je JPEG čtverec i s pozadím.
- **Modely** (`src/assets/models.js`): low-poly hierarchie kvádrů a válců, procedurální animace (chůze, hnětení, T-pose).
- **Zvuk** (`src/engine/audio.js`): WebAudio, vše syntetizované do bufferů 22 kHz s bit-crushingem
  (drony, „fantasy“ melodie z roku 1998 s jednou chybějící notou, dech Kabátu, praskání, bzučení zamrzlé konzole).
  Před důležitými událostmi zvuk záměrně utichá.

## Testy a nástroje

```sh
npm install          # jen puppeteer-core pro testy
npm test             # dohraje celou hru všemi 3 konci v headless Chromiu (~20 min), screenshoty do docs/playtest/
node tools/playtest.js full|e2|e3   # jen jeden průchod
npm run preview      # náhled všech textur a modelů -> docs/preview.png
node tools/dev/audiocheck.js   # zkontroluje zvuky a uloží je jako WAV do docs/audio/
```

Playtest neobchází herní logiku: hru ovládá virtuálními stisky kláves přes stejný vstup jako hráč
(autopilot jen drží šipky). Ladicí skoky: `index.html#skip=kitchen|armory|escape|church|school|hub3|boss`.

## Struktura

```
index.html            vstup hry           preview.html   náhled assetů
src/main.js           smyčka, hráč, kamery, glitche, přechody
src/engine/           ps1.js (render), audio.js, input.js
src/assets/           textures.js, models.js
src/game/             ui.js, menu.js, inventory.js (mapa), npc.js, room.js, bot.js,
                      lore.js (repliky a co maže ukládání), stalker.js (pronásledovatelé + schovávání),
                      flow.js (save krystaly, krystaly paměti, pauza, 3 konce)
src/game/rooms/       hub.js, kitchen.js, armory.js, church.js, school.js, boss.js, memory.js
tools/                serve.js, playtest.js, preview.js, contact.sh, dev/
```

## Poznámky k řešení

- **Jméno hráče pro secret konec**: prohlížeč z bezpečnostních důvodů nezná jméno uživatele OS, proto ho
  hře předává lokální server (`/api/player` v `tools/serve.js`, `os.userInfo()`). Když hra běží bez něj
  (např. přes `python3 -m http.server`), použije se záložní jméno **HRÁČ**.
- Kamera je ve výchozím stavu v první osobě; fixní/poloviční kamery s tank controls ze zadání jsou na klávese **V**.
