// Příběh na jednom místě: repliky NPC podle postupu a podle toho, kolik vzpomínek smazalo ukládání.
// Každé uložení smaže jednu vzpomínku jednoho NPC (pořadí níže). Nic se neříká přímo.

/** Co smaže n-té uložení (1-based). */
export const ERASED = [
  null,
  'Bořek: dcera',        // 1. pekař zapomene, že má dceru
  'Bořek: obličej',      // 2. pekař přijde o obličej
  'strážný: čas',        // 3. strážný, který čekal na pátou, zapomene, na co čeká
  'Oswin: obličej',      // 4. král
];

export const faceless = {
  baker: S => S.saves >= 2,
  guard2: S => S.saves >= 3,
  king: S => S.saves >= 4,
  guard: () => false,
};

export function bakerLine(S) {
  if (S.saves >= 2) return 'Peču. Peču. Peču. Peču.';
  if (S.saves >= 1) return 'Peču chleba. Pro nikoho. Jenom tak, aby to tu vonělo jako doma.';
  return 'Peču chleba pro Aničku. Má ráda kůrku, tu nejtmavší.';
}

export function guardLine(i, S, F) {
  if (i === 0) return 'Krásný den v Ardemooru.';
  if (i === 1) return S.saves >= 3 ? 'Kolik je hodin? Kolik je hodin? Kolik je hodin?' : 'Ještě není pět. Ještě není pět.';
  // strážný u dveří komentuje postup
  const c = F.crown ?? 0;
  if (c >= 3) return 'Čtvrté dveře tu vždycky byly. Jen je nikdo nedokreslil.';
  if (c === 2) return 'Za třetími dveřmi je škola. Tam se čeká nejdéle.';
  if (c === 1) return 'Za druhými dveřmi je voda. Nedýchej. Nebo dýchej, to je jedno.';
  return 'Za prvními dveřmi je kuchyně. Nebo zbrojnice. Záleží, kdo se dívá.';
}

export function kingRepeat(S, F) {
  if (S.saves >= 4) return 'Najdi je. Najdi... koho?';
  const c = F.crown ?? 0;
  if (c >= 3) return 'Koruna je celá. Teď už se jen čeká. Za čtvrtými dveřmi.';
  return `Najdi je. Najdi všechny tři. Zbývá ${3 - c}.`;
}

/** Co řekne král při vložení n-tého krystalu do koruny. */
export const CROWN_LINES = [
  null,
  ['Jeden.', 'Slyšíš to? V koruně je ticho. Takové, jaké bývá v domě, když babička spí.'],
  ['Dva.', 'Tma a voda. Pod postelí je hlouběji, než si dospělí myslí.'],
  ['Tři. Koruna je celá.', 'A přesto je prázdná. Divné, že?', 'Za čtvrtými dveřmi čeká ten, kdo čeká. Čeká už moc dlouho.'],
];

/** Stav NPC do titulků konce 1. */
export function creditsRoster(S) {
  return [
    ['Král Oswin', S.saves >= 4 ? 'bez tváře' : 'koruna je celá'],
    ['Pekař Bořek', S.saves >= 2 ? 'peče' : S.saves >= 1 ? 'peče pro nikoho' : 'peče pro Aničku'],
    ['Strážní', S.saves >= 3 ? 'už nevědí, na co čekají' : 'čekají na pátou'],
    ['Kabát', 'visí na věšáku'],
    ['Zvoník', 'zvoní pod vodou'],
    ['Paní učitelka', 'se dívá na hodinky'],
    ['Wren', 'dohrál'],
    ['Tomáš', ''],
  ];
}
