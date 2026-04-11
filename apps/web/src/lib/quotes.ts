// ---------------------------------------------------------------------------
// Daily rotating quotes for the Creator Hub welcome section.
// Deterministic selection based on the calendar day so the quote stays
// stable within a single day and rotates cleanly at midnight.
// ---------------------------------------------------------------------------

export type QuoteCategory = 'philosophy' | 'sports' | 'business';

export interface Quote {
  text: string;
  author: string;
  category: QuoteCategory;
}

export const QUOTES: Quote[] = [
  // --- Philosophie ---------------------------------------------------------
  { text: 'Ich weiss, dass ich nichts weiss.', author: 'Sokrates', category: 'philosophy' },
  { text: 'Der Anfang ist die Haelfte des Ganzen.', author: 'Platon', category: 'philosophy' },
  { text: 'Die Seele faerbt sich mit der Farbe ihrer Gedanken.', author: 'Marc Aurel', category: 'philosophy' },
  { text: 'Das Glueck deines Lebens haengt von der Beschaffenheit deiner Gedanken ab.', author: 'Marc Aurel', category: 'philosophy' },
  { text: 'Waehle einen Beruf, den du liebst, und du brauchst keinen Tag deines Lebens zu arbeiten.', author: 'Konfuzius', category: 'philosophy' },
  { text: 'Es ist nicht wichtig, wie langsam du gehst, solange du nicht stehen bleibst.', author: 'Konfuzius', category: 'philosophy' },
  { text: 'Wer einen Grund zum Leben hat, ertraegt fast jedes Wie.', author: 'Friedrich Nietzsche', category: 'philosophy' },
  { text: 'Was mich nicht umbringt, macht mich staerker.', author: 'Friedrich Nietzsche', category: 'philosophy' },
  { text: 'Habe Mut, dich deines eigenen Verstandes zu bedienen.', author: 'Immanuel Kant', category: 'philosophy' },
  { text: 'Zwei Dinge erfuellen das Gemuet mit immer neuer Bewunderung: der bestirnte Himmel ueber mir und das moralische Gesetz in mir.', author: 'Immanuel Kant', category: 'philosophy' },
  { text: 'Das Leben ist das, was passiert, waehrend du andere Plaene schmiedest.', author: 'Seneca', category: 'philosophy' },
  { text: 'Kein Mensch betritt denselben Fluss zweimal.', author: 'Heraklit', category: 'philosophy' },
  { text: 'Glueck ist kein Ziel, sondern ein Nebenprodukt eines gut gelebten Lebens.', author: 'Eleanor Roosevelt', category: 'philosophy' },
  { text: 'Die einzige wahre Weisheit besteht darin zu wissen, dass man nichts weiss.', author: 'Sokrates', category: 'philosophy' },
  { text: 'Wer sich selbst besiegt, ist der staerkste Krieger.', author: 'Konfuzius', category: 'philosophy' },
  { text: 'Worauf du deine Aufmerksamkeit richtest, das waechst.', author: 'Epiktet', category: 'philosophy' },

  // --- Sport ---------------------------------------------------------------
  { text: 'Ich habe in meiner Karriere mehr als 9000 Wuerfe verfehlt. Deshalb habe ich Erfolg.', author: 'Michael Jordan', category: 'sports' },
  { text: 'Talent gewinnt Spiele, aber Teamwork und Intelligenz gewinnen Meisterschaften.', author: 'Michael Jordan', category: 'sports' },
  { text: 'Grosse Dinge kommen aus kleinen Anfaengen.', author: 'Kobe Bryant', category: 'sports' },
  { text: 'Harte Arbeit schlaegt Talent, wenn Talent nicht hart arbeitet.', author: 'Kobe Bryant', category: 'sports' },
  { text: 'Mamba Mentality heisst, jeden Tag besser werden zu wollen.', author: 'Kobe Bryant', category: 'sports' },
  { text: 'Ich zaehle meine Sit-ups erst, wenn es anfaengt zu schmerzen.', author: 'Muhammad Ali', category: 'sports' },
  { text: 'Fliege wie ein Schmetterling, stich wie eine Biene.', author: 'Muhammad Ali', category: 'sports' },
  { text: 'Der Mann, der keine Risiken eingeht, wird im Leben nichts erreichen.', author: 'Muhammad Ali', category: 'sports' },
  { text: 'Dein Talent bestimmt, was du kannst. Deine Motivation, wie viel du tust. Deine Haltung, wie gut du es machst.', author: 'Lou Holtz', category: 'sports' },
  { text: 'Ich bin nicht der Beste. Ich bin nur der, der am haertesten arbeitet.', author: 'Cristiano Ronaldo', category: 'sports' },
  { text: 'Talent ohne harte Arbeit ist nichts.', author: 'Cristiano Ronaldo', category: 'sports' },
  { text: 'Du musst erwarten, dass du grossartige Dinge vollbringen kannst.', author: 'Michael Phelps', category: 'sports' },
  { text: 'Jeder Champion war einmal ein Anfaenger, der nicht aufgegeben hat.', author: 'Serena Williams', category: 'sports' },
  { text: 'Ich habe immer geglaubt, dass ich die Beste sein kann.', author: 'Serena Williams', category: 'sports' },
  { text: 'Ich traeume nicht. Ich setze Ziele.', author: 'Usain Bolt', category: 'sports' },
  { text: 'Ich denke, Grenzen sind furchteinfloessend, weil die Leute sie sich selber setzen.', author: 'Usain Bolt', category: 'sports' },

  // --- Business ------------------------------------------------------------
  { text: 'Stay hungry. Stay foolish.', author: 'Steve Jobs', category: 'business' },
  { text: 'Innovation unterscheidet zwischen einem Anfuehrer und einem Nachfolger.', author: 'Steve Jobs', category: 'business' },
  { text: 'Der einzige Weg, grossartige Arbeit zu leisten, ist zu lieben, was du tust.', author: 'Steve Jobs', category: 'business' },
  { text: 'Wenn etwas wichtig genug ist, tust du es, auch wenn die Chancen nicht zu deinen Gunsten stehen.', author: 'Elon Musk', category: 'business' },
  { text: 'Scheitern ist hier eine Option. Wenn die Dinge nicht scheitern, bist du nicht innovativ genug.', author: 'Elon Musk', category: 'business' },
  { text: 'Konzentriere dich auf Signal ueber Rauschen. Verschwende keine Zeit mit Dingen, die nichts besser machen.', author: 'Elon Musk', category: 'business' },
  { text: 'Es ist besser, mit einem wunderbaren Unternehmen zu einem fairen Preis zu kaufen, als ein faires Unternehmen zu einem wunderbaren Preis.', author: 'Warren Buffett', category: 'business' },
  { text: 'Regel Nummer eins: Verliere nie Geld. Regel Nummer zwei: Vergiss nie Regel Nummer eins.', author: 'Warren Buffett', category: 'business' },
  { text: 'Risiko entsteht dadurch, dass du nicht weisst, was du tust.', author: 'Warren Buffett', category: 'business' },
  { text: 'Deine unzufriedensten Kunden sind deine groesste Lernquelle.', author: 'Bill Gates', category: 'business' },
  { text: 'Erfolg ist ein mieser Lehrer. Er verleitet kluge Menschen dazu zu denken, sie koennten nicht verlieren.', author: 'Bill Gates', category: 'business' },
  { text: 'Wir scheitern alle. Der Trick ist, dass das, was du nicht bist, deine Staerke werden kann.', author: 'Jeff Bezos', category: 'business' },
  { text: 'Deine Marke ist das, was andere ueber dich sagen, wenn du nicht im Raum bist.', author: 'Jeff Bezos', category: 'business' },
  { text: 'Wenn du zum Kunden besessen bist, gewinnst du fast immer.', author: 'Jeff Bezos', category: 'business' },
  { text: 'Das Geheimnis des Erfolges ist, den Standpunkt des anderen zu verstehen.', author: 'Henry Ford', category: 'business' },
  { text: 'Egal ob du glaubst, dass du es schaffst, oder nicht: Du wirst auf jeden Fall Recht behalten.', author: 'Henry Ford', category: 'business' },
  { text: 'Der einzige echte Fehler ist der, aus dem wir nichts lernen.', author: 'Henry Ford', category: 'business' },
  { text: 'Was du bist, ist Gottes Geschenk an dich. Was du daraus machst, ist dein Geschenk an Gott.', author: 'Oprah Winfrey', category: 'business' },
  { text: 'Du wirst, was du glaubst.', author: 'Oprah Winfrey', category: 'business' },
  { text: 'Dinge zu wollen ist nicht dasselbe wie Dinge zu brauchen. Oft bringt uns der Hunger weiter als das Sattsein.', author: 'Oprah Winfrey', category: 'business' },
  { text: 'Wenn du alle deine Kunden zufriedenstellen willst, wirst du nie durchbrechen.', author: 'Seth Godin', category: 'business' },
  { text: 'Dein wertvollstes Gut ist nicht Zeit, sondern Aufmerksamkeit.', author: 'Naval Ravikant', category: 'business' },
];

// ---------------------------------------------------------------------------
// Deterministic quote-of-the-day selection
// ---------------------------------------------------------------------------

/**
 * Hash a YYYY-MM-DD string into a stable small integer.
 * Same day -> same hash -> same quote.
 */
function hashDate(dateStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Make sure we return a positive integer.
  return h >>> 0;
}

/**
 * Returns a stable quote for a given date. Rotates at local midnight.
 */
export function getQuoteForDate(date: Date): Quote {
  const iso = date.toISOString().slice(0, 10);
  const index = hashDate(iso) % QUOTES.length;
  return QUOTES[index];
}
