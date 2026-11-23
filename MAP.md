# PRÁZDNÁ KORUNA — mapa a propojení

```
                          ┌──────────────────────────┐
                          │  MENU (rozbité)          │
                          │  Nová hra ✗  Nastavení ✗ │
                          │  Načíst hru → „NEHRÁT    │
                          │  ZNOVU“                  │
                          └────────────┬─────────────┘
                                       │ načíst
                                       ▼
 ┌─────────────────────────── HUB: NÁDVOŘÍ ARDEMOORU (16:47) ──────────────────────────┐
 │  trůn + král Oswin (koruna nad trůnem)   strážní ×3   pekař Bořek   save krystal      │
 │                                                                                     │
 │  dveře I ────────┐  dveře II ───────┐  dveře III ──────┐  dveře IV ────────┐         │
 │  (hned)          │  (po krystalu 1) │  (po krystalu 2) │  (koruna celá)   │         │
 └──────────────────┼──────────────────┼──────────────────┼──────────────────┼─────────┘
                    ▼                  ▼                  ▼                  ▼
          ┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐
          │ 1 KUCHYNĚ        │ │ 2 KOSTEL       │ │ 3 ŠKOLNÍ CHODBA  │ │ TEN, KDO ČEKÁ    │
          │ (nekonečná       │ │ POD VODOU      │ │                  │ │ loading bar 99 % │
          │ smyčka)          │ │                │ │ chodba ── třída  │ │ ohýbá prostor    │
          │      │ sporák    │ │ zvony 16-4-7   │ │   │ skříňka 1647 │ │                  │
          │      ▼ + klíč    │ │      │         │ │   ▼ propustka    │ │ hádanka: jdi     │
          │ ZBROJNICE        │ │      ▼         │ │ TRŮNNÍ SÁL       │ │ k němu zády      │
          │ (Kabát)          │ │ oltář (Zvoník) │ │ (Učitelka)       │ │        │         │
          │      │           │ │      │         │ │      │           │ │        ▼         │
          │ Krystal 1        │ │ Krystal 2      │ │ Krystal 3        │ │   ROZHODNUTÍ     │
          │ vzpomínka:       │ │ vzpomínka:     │ │ vzpomínka:       │ │ ├ DOKONČIT → K1  │
          │ babička, ticho   │ │ tma, hloubka   │ │ nikdo nepřišel   │ │ ├ VYPNOUT  → K2  │
          └────────┬─────────┘ └───────┬────────┘ └────────┬─────────┘ │ └ NIC (čeká)     │
                   └── útěk ───────────┴──── útěk ─────────┘           └──────────────────┘
                     zpět do hubu přes loading bar zaseknutý na 99 %

  SECRET (K3): po složení koruny otevři pauzu (Esc) a ~40 s nedělej nic.
```

## Hub — Nádvoří Ardemooru
- Start na jihu. Na severu trůn s králem Oswinem, nad trůnem se točí koruna a plní se vloženými krystaly.
- Západ: pekař Bořek u pece. Východní zeď: dveře **I–III** a od složení koruny i **IV** (na mapě byly vždycky — mapa „lhala“, dokud to nebyla pravda).
- Save krystal u studny.
- Král po vložení krystalu otevře další dveře; neodemčené dveře hlásí **NENAČTENO**.

## Level 1 — Nekonečná kuchyně / zbrojnice (krystal: babička a ticho v domě)
1. **Kuchyně**: dveře na severu vedou zpátky do té samé kuchyně (každá smyčka je divnější: židle, PLACEHOLDER zeď, strážný v T-pose, zdvojený pekař).
2. **Hádanka 1**: dětská kresba „JAK SE ZHASÍNÁ“ (3 1 2) → zavřít hořáky prostřední, pravý, levý. Smyčka se zlomí.
3. **Hádanka 2**: vychladlá trouba → klíč od zbrojnice.
4. **Zbrojnice**: hlídkuje **Kabát** (vidí a slyší), skříně na schování, předsíň u vchodu je bezpečná. Krystal na severu.
5. Vzpomínka → útěk; **„Memory card full“** vyskočí přesně ve chvíli, kdy se Kabát zhmotní vedle tebe.

## Level 2 — Kostel pod vodou (krystal: strach z hloubky a ze tmy)
- Zatopená loď kostela, hladina nad hlavou, bubliny, vlnící se geometrie, pod vodou se chodí pomaleji.
- **Zvoník** je slepý: slyší jen pohyb. Když stojíš, neslyší tě. Zpovědnice na schování.
- **Hádanka**: tabule s čísly písní 16 / 4 / 7 → zatáhnout za zvony v tomto pořadí. Zvon **5** je návnada („v pět nikdo nepřišel“); špatný zvon přivolá Zvoníka.
- Mříž před oltářem klesne → krystal → vzpomínka → útěk; **zhasne všechno světlo**.

## Level 3 — Školní chodba, která končí trůnním sálem (krystal: nikdo tě nevyzvedne)
- Dlouhá chodba se skříňkami, třída, věšák s posledním kabátem, vygumovaná rodina na kresbě.
- **Učitelka** bez obličeje hlídá chodbu (vidí daleko, zvoní ručním zvonkem); schovávání ve skříňkách.
- **Hádanka**: tabule „Kolik je hodin, když se čeká nejdéle?“ + hodiny všude → Tomášova skříňka **1647** → propustka (bez podpisu rodiče) a lísteček „zůstaň v menu“.
- Propustka otevře dveře do **trůnního sálu** (dětský trůn, papírová koruna) → krystal → vzpomínka → útěk; **„Ovladač odpojen“** v nejhorší chvíli.

## Boss — Ten, kdo čeká
- Prázdnota poskládaná z kusů všech levelů, všichni NPC stojí v T-pose a dívají se.
- Obří loading bar zaseknutý na 99 % kroutí prostor kolem sebe (shader).
- **Hádanka**: když jdeš k baru čelem, prostor se natahuje a odsouvá tě. Vzkaz „Na to, co čeká, se nedívej. Jdi k tomu zády.“ → dojít couváním.
- **Rozhodnutí**: DOKONČIT NAČÍTÁNÍ / VYPNOUT KONZOLI / NIC.

## Save systém (každé uložení smaže jednu vzpomínku jednoho NPC)
| uložení | co se smaže | změna |
|---|---|---|
| 1. | Bořek: dcera | „Peču chleba. Pro nikoho.“ |
| 2. | Bořek: obličej | model bez obličeje, „Peču. Peču. Peču.“ |
| 3. | strážný: čas | bez obličeje, „Kolik je hodin?“ |
| 4. | Oswin: obličej | bez obličeje, „Najdi... koho?“ |

Save krystaly: hub, kuchyně, kostel, třída (4 celkem). Ukládání je dobrovolné.

## Konce
1. **DOHRÁNO** — dokončit načítání: bar dojede na 100 %, Tomáš se vymaže, klidné titulky („Je 17:00. Nikdo už nečeká.“). Save se přejmenuje na DOKONČENO.
2. **ČEKÁNÍ** — vypnout konzoli (u bosse nebo v pauze po složení koruny): CRT zhasne, Ardemoor zůstane navždy ve 16:47 a NPC stojí a čekají.
3. **JMÉNO (secret)** — nechat Wrena v menu: po složení koruny otevřít pauzu a ~40 s nic nedělat. Save „NEHRÁT ZNOVU“ se přepíše na jméno uživatele OS a Tomáš nechá vzkaz.
