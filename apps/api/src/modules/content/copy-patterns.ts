// ---------------------------------------------------------------------------
// copy-patterns.ts — Elite copywriting pattern library
// Power words, hook templates, CTA patterns, and platform-specific banks
// for English and German
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Power Words
// ---------------------------------------------------------------------------

export const POWER_WORDS = {
  urgency: {
    en: [
      'now', 'today', 'instantly', 'immediately', 'hurry', 'limited',
      'expires', 'deadline', 'last chance', 'running out', 'before midnight',
      'act fast', 'while supplies last', 'ending soon', 'don\'t wait',
      'final hours', 'closing', 'urgent', 'time-sensitive', 'one-time',
    ],
    de: [
      'jetzt', 'heute', 'sofort', 'sofort', 'schnell', 'begrenzt',
      'läuft ab', 'Frist', 'letzte Chance', 'geht aus', 'vor Mitternacht',
      'schnell handeln', 'solange der Vorrat reicht', 'endet bald', 'warte nicht',
      'letzte Stunden', 'Schluss', 'dringend', 'zeitlich begrenzt', 'einmalig',
    ],
  },
  emotion: {
    en: [
      'love', 'obsessed', 'life-changing', 'jaw-dropping', 'stunning',
      'breathtaking', 'magical', 'heavenly', 'dreamy', 'radiant',
      'glowing', 'confident', 'empowered', 'unstoppable', 'blissful',
      'transformed', 'rejuvenated', 'vibrant', 'luxurious', 'indulgent',
    ],
    de: [
      'Liebe', 'besessen', 'lebensverändernd', 'atemberaubend', 'umwerfend',
      'atemberaubend', 'magisch', 'himmlisch', 'traumhaft', 'strahlend',
      'leuchtend', 'selbstbewusst', 'gestärkt', 'unaufhaltbar', 'glückselig',
      'verwandelt', 'verjüngt', 'lebendig', 'luxuriös', 'genussvoll',
    ],
  },
  trust: {
    en: [
      'proven', 'backed by science', 'dermatologist-tested', 'clinically proven',
      'certified', 'guaranteed', 'award-winning', 'trusted by', 'recommended',
      'verified', 'authentic', 'results-driven', 'evidence-based', 'doctor-approved',
      'lab-tested', 'third-party tested', 'peer-reviewed', 'endorsed', 'accredited',
      'FDA-approved',
    ],
    de: [
      'bewiesen', 'wissenschaftlich belegt', 'dermatologisch getestet', 'klinisch bewiesen',
      'zertifiziert', 'garantiert', 'preisgekrönt', 'empfohlen von', 'empfohlen',
      'verifiziert', 'authentisch', 'ergebnisorientiert', 'evidenzbasiert', 'ärztlich empfohlen',
      'laborgetestet', 'unabhängig getestet', 'peer-reviewed', 'unterstützt', 'akkreditiert',
      'behördlich zugelassen',
    ],
  },
  curiosity: {
    en: [
      'secret', 'hidden', 'little-known', 'surprising', 'unexpected',
      'shocking', 'controversial', 'insider', 'underground', 'forbidden',
      'untold', 'mystery', 'behind the scenes', 'what nobody tells you',
      'the truth about', 'exposed', 'revealed', 'uncovered', 'decoded',
      'breakthrough',
    ],
    de: [
      'Geheimnis', 'versteckt', 'wenig bekannt', 'überraschend', 'unerwartet',
      'schockierend', 'kontrovers', 'Insider', 'underground', 'verboten',
      'unerzählt', 'Mysterium', 'hinter den Kulissen', 'was dir keiner sagt',
      'die Wahrheit über', 'enthüllt', 'aufgedeckt', 'entdeckt', 'entschlüsselt',
      'Durchbruch',
    ],
  },
  exclusivity: {
    en: [
      'exclusive', 'VIP', 'members-only', 'invitation-only', 'first access',
      'limited edition', 'rare', 'handpicked', 'curated', 'bespoke',
      'premium', 'elite', 'luxury', 'select', 'private',
      'early access', 'founding member', 'inner circle', 'waitlist', 'sold out',
    ],
    de: [
      'exklusiv', 'VIP', 'nur für Mitglieder', 'nur auf Einladung', 'Erstzugang',
      'limitierte Auflage', 'selten', 'handverlesen', 'kuratiert', 'maßgeschneidert',
      'Premium', 'Elite', 'Luxus', 'ausgewählt', 'privat',
      'Frühzugang', 'Gründungsmitglied', 'innerer Kreis', 'Warteliste', 'ausverkauft',
    ],
  },
};

// ---------------------------------------------------------------------------
// Hook Patterns (60+ templates)
// ---------------------------------------------------------------------------

export const HOOK_PATTERNS = {
  en: {
    pattern_interrupt: [
      'Stop scrolling if you {painPoint}.',
      'Wait. You need to see this before you {action}.',
      'I\'m going to say something controversial about {topic}.',
      'Unfollow me if you disagree, but {boldClaim}.',
      'This is the video I wish I had seen {timeAgo}.',
      'Delete every {competitor} from your cart right now.',
      'I\'m begging you to stop {badHabit}.',
    ],
    question: [
      'Why do {percentage}% of {audience} struggle with {problem}?',
      'What if I told you {boldClaim}?',
      'Has anyone else noticed that {observation}?',
      'Want to know the real reason {phenomenon}?',
      'Still using {oldSolution}? Here\'s why you should stop.',
      'What\'s the one thing {experts} wish you knew about {topic}?',
      'Why are so many {audience} switching to {product}?',
    ],
    statistic: [
      '{number} out of {total} {audience} don\'t know about {secret}.',
      '{percentage}% of {audience} get this wrong.',
      'We surveyed {number} {audience}. The results were shocking.',
      'After {number} hours of testing, one product stood out.',
      '{product} has been rated #{rank} by {authority}.',
      'In just {time}, {number} people have already switched.',
      '{percentage}% of our customers reorder within {time}.',
    ],
    curiosity_gap: [
      'The secret ingredient that {benefit} (it\'s not what you think).',
      'I finally found out why {phenomenon}. And it changed everything.',
      'The {industry} doesn\'t want you to know this about {topic}.',
      'There\'s a reason {audience} are obsessed with this. Let me explain.',
      'This one change {transformed} my entire {routine}.',
      'The weird trick that {benefit}. (No, seriously.)',
      'Everyone is talking about this, but nobody is saying {truth}.',
    ],
    social_proof: [
      'Over {number} customers have already switched to {product}.',
      'Join {number}+ {audience} who {benefit} with {product}.',
      'Rated {rating}/5 by {number} verified buyers.',
      '{influencer} couldn\'t believe the results from {product}.',
      'This product went viral for a reason. Here\'s the real story.',
      '#1 bestseller in {category} for {time} straight.',
      'Our customers\' {metric} improved by {percentage}% on average.',
    ],
    urgency_scarcity: [
      'Last chance to get {product} at this price.',
      'Only {number} left in stock. Once they\'re gone, they\'re gone.',
      'This offer ends at midnight. Don\'t say I didn\'t warn you.',
      '{product} is selling {rate}x faster than we expected.',
      'We had to cap orders at {number} per customer.',
      'Back in stock for 48 hours only.',
      'Our {event} sale starts NOW. {discount}% off everything.',
    ],
    benefit_led: [
      'Get {benefit} in just {time} with {product}.',
      'Finally: {benefit} without {sacrifice}.',
      'Imagine waking up to {benefit}. That\'s what {product} does.',
      '{benefit} on day one. {biggerBenefit} by week {number}.',
      'The easiest way to {benefit} I\'ve ever tried.',
      'One product. {number} benefits. Zero compromises.',
      '{product}: because you deserve {benefit} without the {hassle}.',
    ],
    pain_point: [
      'Tired of {problem}? There\'s finally a solution that works.',
      'If {problem} is ruining your {area}, read this.',
      'I wasted ${amount} on {problem} before finding this.',
      'Nothing worked for my {problem}. Until now.',
      'The {problem} struggle is real. But it doesn\'t have to be.',
      'Raise your hand if you\'re sick of {problem}.',
      'Dear everyone with {problem}: your life is about to change.',
    ],
    transformation: [
      'From {before} to {after} in just {time}.',
      'How I went from {before} to {after} with one simple change.',
      '{time} ago, I was {before}. Today? {after}.',
      'The transformation that made my {person} cry.',
      'I documented my {time} journey. The results speak for themselves.',
      'Before {product}: {before}. After: {after}.',
      'My {before} to {after} story (and how you can do it too).',
    ],
    authority: [
      'Dermatologists recommend this over {percentage}% of alternatives.',
      '{expert} explains why {product} is the gold standard.',
      'Used by {number}+ professionals in {industry}.',
      'The brand that {celebrity/expert} trusts for {use}.',
      'Developed with {number} years of {field} research.',
      'As featured in {publication}, {publication}, and {publication}.',
      'The formula that {experts} call "the future of {category}."',
    ],
  },
  de: {
    pattern_interrupt: [
      'Hör auf zu scrollen, wenn du {painPoint}.',
      'Warte. Du musst das sehen, bevor du {action}.',
      'Ich sage jetzt etwas Kontroverses über {topic}.',
      'Entfolge mir, wenn du nicht einverstanden bist, aber {boldClaim}.',
      'Das ist das Video, das ich mir vor {timeAgo} gewünscht hätte.',
      'Lösch sofort alle {competitor} aus deinem Warenkorb.',
      'Ich flehe dich an, mit {badHabit} aufzuhören.',
    ],
    question: [
      'Warum kämpfen {percentage}% aller {audience} mit {problem}?',
      'Was wäre, wenn ich dir sage, dass {boldClaim}?',
      'Ist es noch jemandem aufgefallen, dass {observation}?',
      'Willst du den wahren Grund für {phenomenon} wissen?',
      'Benutzt du immer noch {oldSolution}? Hier ist, warum du aufhören solltest.',
      'Was ist das eine, das {experts} dir über {topic} sagen wollen?',
      'Warum wechseln so viele {audience} zu {product}?',
    ],
    statistic: [
      '{number} von {total} {audience} wissen das nicht über {secret}.',
      '{percentage}% aller {audience} machen diesen Fehler.',
      'Wir haben {number} {audience} befragt. Die Ergebnisse waren schockierend.',
      'Nach {number} Stunden Testing stach ein Produkt heraus.',
      '{product} wurde von {authority} auf Platz #{rank} bewertet.',
      'In nur {time} haben bereits {number} Menschen gewechselt.',
      '{percentage}% unserer Kunden bestellen innerhalb von {time} nach.',
    ],
    curiosity_gap: [
      'Die geheime Zutat, die {benefit} (es ist nicht das, was du denkst).',
      'Ich habe endlich herausgefunden, warum {phenomenon}. Und es hat alles verändert.',
      'Die {industry} will nicht, dass du das über {topic} weißt.',
      'Es gibt einen Grund, warum {audience} davon besessen sind. Lass mich erklären.',
      'Diese eine Änderung hat meine gesamte {routine} transformiert.',
      'Der verrückte Trick, der {benefit}. (Nein, wirklich.)',
      'Alle reden darüber, aber niemand sagt {truth}.',
    ],
    social_proof: [
      'Über {number} Kunden haben bereits zu {product} gewechselt.',
      'Schließ dich {number}+ {audience} an, die mit {product} {benefit}.',
      'Bewertet mit {rating}/5 von {number} verifizierten Käufern.',
      '{influencer} konnte die Ergebnisse von {product} nicht glauben.',
      'Dieses Produkt ging aus gutem Grund viral. Hier ist die wahre Geschichte.',
      '#1 Bestseller in {category} seit {time}.',
      'Die {metric} unserer Kunden verbesserten sich um durchschnittlich {percentage}%.',
    ],
    urgency_scarcity: [
      'Letzte Chance, {product} zu diesem Preis zu bekommen.',
      'Nur noch {number} auf Lager. Wenn sie weg sind, sind sie weg.',
      'Dieses Angebot endet um Mitternacht. Sag nicht, ich hätte dich nicht gewarnt.',
      '{product} verkauft sich {rate}x schneller als erwartet.',
      'Wir mussten die Bestellungen auf {number} pro Kunde begrenzen.',
      'Nur 48 Stunden wieder verfügbar.',
      'Unser {event}-Sale startet JETZT. {discount}% auf alles.',
    ],
    benefit_led: [
      'Erreiche {benefit} in nur {time} mit {product}.',
      'Endlich: {benefit} ohne {sacrifice}.',
      'Stell dir vor, du wachst mit {benefit} auf. Das macht {product}.',
      '{benefit} ab Tag eins. {biggerBenefit} bis Woche {number}.',
      'Der einfachste Weg zu {benefit}, den ich je probiert habe.',
      'Ein Produkt. {number} Vorteile. Null Kompromisse.',
      '{product}: weil du {benefit} ohne {hassle} verdienst.',
    ],
    pain_point: [
      'Genug von {problem}? Es gibt endlich eine Lösung, die funktioniert.',
      'Wenn {problem} dein {area} ruiniert, lies das.',
      'Ich habe {amount}EUR für {problem} verschwendet, bevor ich das gefunden habe.',
      'Nichts hat bei meinem {problem} funktioniert. Bis jetzt.',
      'Der {problem}-Kampf ist real. Aber das muss nicht so bleiben.',
      'Hand hoch, wenn du {problem} satt hast.',
      'An alle mit {problem}: Dein Leben wird sich gleich ändern.',
    ],
    transformation: [
      'Von {before} zu {after} in nur {time}.',
      'Wie ich mit einer einfachen Änderung von {before} zu {after} kam.',
      'Vor {time} war ich {before}. Heute? {after}.',
      'Die Transformation, die meine {person} zum Weinen brachte.',
      'Ich habe meine {time}-Reise dokumentiert. Die Ergebnisse sprechen für sich.',
      'Vor {product}: {before}. Danach: {after}.',
      'Meine {before}-zu-{after}-Geschichte (und wie du es auch schaffen kannst).',
    ],
    authority: [
      'Dermatologen empfehlen dies gegenüber {percentage}% der Alternativen.',
      '{expert} erklärt, warum {product} der Goldstandard ist.',
      'Verwendet von {number}+ Fachleuten in {industry}.',
      'Die Marke, der {celebrity/expert} für {use} vertraut.',
      'Entwickelt mit {number} Jahren {field}-Forschung.',
      'Bekannt aus {publication}, {publication} und {publication}.',
      'Die Formel, die {experts} "die Zukunft von {category}" nennen.',
    ],
  },
};

// ---------------------------------------------------------------------------
// CTA Patterns (35+ templates)
// ---------------------------------------------------------------------------

export const CTA_PATTERNS = {
  en: {
    urgency: [
      'Shop now before it\'s gone.',
      'Get yours today — sale ends midnight.',
      'Don\'t wait. This deal won\'t last.',
      'Claim your {discount}% off NOW.',
      'Last chance — order before we sell out.',
    ],
    benefit: [
      'Start your transformation today.',
      'Get {benefit} — tap the link.',
      'Ready for {benefit}? Click below.',
      'Unlock {benefit} in {time}.',
      'Your journey to {benefit} starts here.',
    ],
    social_proof: [
      'Join {number}+ happy customers.',
      'See why everyone is switching.',
      'Be part of the {product} movement.',
      'Join the {number}+ who already love it.',
      'Don\'t be the last to try it.',
    ],
    question: [
      'Ready to finally {benefit}?',
      'What are you waiting for?',
      'Want {benefit} without {hassle}?',
      'Tired of {problem}? Try this.',
      'Why keep struggling when the solution is right here?',
    ],
    command: [
      'Click the link. Change your life.',
      'Tap below. Thank us later.',
      'Add to cart. You deserve this.',
      'Stop overthinking it. Just try it.',
      'Do yourself a favor — get this today.',
    ],
    fomo: [
      'Everyone else already has theirs.',
      '{number} people are viewing this right now.',
      'Don\'t miss what {number}+ people already discovered.',
      'This is your sign. Don\'t let it pass.',
      'Your future self will thank you.',
    ],
    guarantee: [
      'Try it risk-free with our {days}-day guarantee.',
      '100% money-back guarantee. Zero risk.',
      'Love it or your money back. Simple.',
      'No questions asked — full refund if you\'re not amazed.',
      'Risk-free. Regret-free. Guaranteed.',
    ],
    exclusive: [
      'Exclusive offer for our followers only.',
      'Use code {code} for {discount}% off.',
      'VIP access — link in bio.',
      'First {number} orders get a free {bonus}.',
      'This deal is not available anywhere else.',
    ],
  },
  de: {
    urgency: [
      'Jetzt bestellen, bevor es weg ist.',
      'Sichere dir deins heute — Angebot endet um Mitternacht.',
      'Warte nicht. Dieses Angebot hält nicht ewig.',
      'Sichere dir jetzt {discount}% Rabatt.',
      'Letzte Chance — bestelle bevor ausverkauft.',
    ],
    benefit: [
      'Starte deine Transformation heute.',
      'Erreiche {benefit} — klick auf den Link.',
      'Bereit für {benefit}? Klick unten.',
      'Entdecke {benefit} in {time}.',
      'Dein Weg zu {benefit} beginnt hier.',
    ],
    social_proof: [
      'Schließ dich {number}+ zufriedenen Kunden an.',
      'Erfahre, warum alle wechseln.',
      'Werde Teil der {product}-Bewegung.',
      'Schließ dich den {number}+ an, die es bereits lieben.',
      'Sei nicht der Letzte, der es probiert.',
    ],
    question: [
      'Bereit, endlich {benefit} zu erreichen?',
      'Worauf wartest du noch?',
      '{benefit} ohne {hassle} — willst du das?',
      'Genug von {problem}? Probier das.',
      'Warum weiterkämpfen, wenn die Lösung hier ist?',
    ],
    command: [
      'Klick den Link. Verändere dein Leben.',
      'Tipp unten drauf. Danke uns später.',
      'In den Warenkorb. Du verdienst das.',
      'Hör auf zu grübeln. Probier es einfach.',
      'Tu dir selbst einen Gefallen — hol dir das heute.',
    ],
    fomo: [
      'Alle anderen haben ihres schon.',
      '{number} Leute schauen sich das gerade an.',
      'Verpasse nicht, was {number}+ bereits entdeckt haben.',
      'Das ist dein Zeichen. Lass es nicht vorbeiziehen.',
      'Dein zukünftiges Ich wird dir danken.',
    ],
    guarantee: [
      'Teste es risikofrei mit unserer {days}-Tage-Garantie.',
      '100% Geld-zurück-Garantie. Null Risiko.',
      'Liebe es oder Geld zurück. So einfach.',
      'Keine Fragen — volle Rückerstattung bei Unzufriedenheit.',
      'Risikofrei. Reuefrei. Garantiert.',
    ],
    exclusive: [
      'Exklusives Angebot nur für unsere Follower.',
      'Nutze Code {code} für {discount}% Rabatt.',
      'VIP-Zugang — Link in Bio.',
      'Die ersten {number} Bestellungen erhalten ein kostenloses {bonus}.',
      'Dieses Angebot gibt es nirgendwo anders.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Transition Phrases
// ---------------------------------------------------------------------------

export const TRANSITIONS = {
  en: {
    problem_to_solution: [
      'That\'s exactly why we created',
      'Which is why we built',
      'Enter:',
      'Meet your new secret weapon:',
      'The answer?',
      'Here\'s the game-changer:',
      'Introducing',
    ],
    feature_to_benefit: [
      'Which means',
      'So you can',
      'Giving you',
      'Resulting in',
      'Translation:',
      'In other words,',
      'The bottom line?',
    ],
    proof_to_cta: [
      'And now it\'s your turn.',
      'Ready to experience it yourself?',
      'Don\'t just take our word for it.',
      'The only question left is:',
      'So what are you waiting for?',
      'Your move.',
      'The results speak for themselves.',
    ],
    story_connectors: [
      'Here\'s the thing:',
      'But here\'s where it gets interesting.',
      'And then I discovered something.',
      'Fast forward to today.',
      'The turning point came when',
      'What happened next surprised even me.',
      'Let me explain.',
    ],
  },
  de: {
    problem_to_solution: [
      'Genau deshalb haben wir entwickelt:',
      'Deshalb haben wir gebaut:',
      'Vorhang auf:',
      'Deine neue Geheimwaffe:',
      'Die Antwort?',
      'Hier kommt der Gamechanger:',
      'Wir präsentieren',
    ],
    feature_to_benefit: [
      'Das bedeutet',
      'Damit du',
      'Das gibt dir',
      'Mit dem Ergebnis:',
      'Übersetzt:',
      'Anders gesagt,',
      'Unterm Strich:',
    ],
    proof_to_cta: [
      'Und jetzt bist du dran.',
      'Bereit, es selbst zu erleben?',
      'Glaub nicht nur uns.',
      'Die einzige Frage ist:',
      'Also, worauf wartest du?',
      'Dein Zug.',
      'Die Ergebnisse sprechen für sich.',
    ],
    story_connectors: [
      'Die Sache ist die:',
      'Aber hier wird es interessant.',
      'Und dann habe ich etwas entdeckt.',
      'Schnell vorspulen bis heute.',
      'Der Wendepunkt kam, als',
      'Was dann passierte, überraschte sogar mich.',
      'Lass mich erklären.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Social Proof Templates
// ---------------------------------------------------------------------------

export const SOCIAL_PROOF_BLOCKS = {
  en: [
    '"I\'ve tried everything and nothing comes close to {product}." — Verified Buyer',
    '"My {person} noticed the difference after just {time}." — {name}, Verified Buyer',
    'Rated {rating} stars by {number}+ customers.',
    'Over {number} 5-star reviews and counting.',
    '{percentage}% of customers say they would recommend {product} to a friend.',
    'Featured in {publication} as a top pick for {year}.',
    'Winner of the {award} for Best {category}.',
    '"This is the only {category} product I\'ll ever use again." — {name}',
    '#1 rated {category} product on {platform}.',
    'Trusted by {number}+ professionals worldwide.',
  ],
  de: [
    '"Ich habe alles ausprobiert — nichts kommt an {product} ran." — Verifizierter Käufer',
    '"Mein/e {person} hat den Unterschied nach nur {time} bemerkt." — {name}, Verifizierte/r Käufer/in',
    'Bewertet mit {rating} Sternen von {number}+ Kunden.',
    'Über {number} 5-Sterne-Bewertungen und es werden mehr.',
    '{percentage}% der Kunden empfehlen {product} weiter.',
    'Vorgestellt in {publication} als Top-Wahl für {year}.',
    'Gewinner des {award} für Bestes {category}.',
    '"Das ist das einzige {category}-Produkt, das ich je wieder benutzen werde." — {name}',
    '#1 bewertetes {category}-Produkt auf {platform}.',
    'Vertraut von {number}+ Fachleuten weltweit.',
  ],
};

// ---------------------------------------------------------------------------
// Objection Handlers
// ---------------------------------------------------------------------------

export const OBJECTION_HANDLERS = {
  en: {
    price: [
      'Yes, it\'s an investment. But consider what you\'re spending on {alternatives} that don\'t work.',
      'Broken down, that\'s less than {dailyCost} per day for {benefit}.',
      'Our customers save an average of {savings} by switching from {alternatives}.',
      'Think of it this way: how much is {benefit} worth to you?',
    ],
    skepticism: [
      'We get it — you\'ve been burned before. That\'s why we offer a {days}-day money-back guarantee.',
      'Don\'t take our word for it. Read what {number}+ verified customers are saying.',
      'We wouldn\'t stake our reputation on something that doesn\'t work.',
      'The proof is in the {metric}: {statistic}.',
    ],
    timing: [
      'There\'s never a "perfect time." But there IS a limited-time offer.',
      'The best time to start was yesterday. The second best time is now.',
      'Every day you wait is another day without {benefit}.',
      'Your future self will wish you started today.',
    ],
    need: [
      'You might not think you need this. But {percentage}% of our customers said the same thing.',
      'If you\'ve ever {relatable_struggle}, this is for you.',
      'You don\'t know what you\'re missing until you try it.',
      'This isn\'t a want. It\'s the upgrade your {routine} has been waiting for.',
    ],
  },
  de: {
    price: [
      'Ja, es ist eine Investition. Aber denk daran, was du für {alternatives} ausgibst, die nicht funktionieren.',
      'Heruntergebrochen sind das weniger als {dailyCost} pro Tag für {benefit}.',
      'Unsere Kunden sparen durchschnittlich {savings} beim Wechsel von {alternatives}.',
      'Denk mal so: Was ist dir {benefit} wert?',
    ],
    skepticism: [
      'Wir verstehen — du wurdest schon enttäuscht. Deshalb bieten wir eine {days}-Tage-Geld-zurück-Garantie.',
      'Glaub nicht uns. Lies, was {number}+ verifizierte Kunden sagen.',
      'Wir würden unseren Ruf nicht für etwas riskieren, das nicht funktioniert.',
      'Der Beweis steckt in {metric}: {statistic}.',
    ],
    timing: [
      'Es gibt nie den "perfekten Zeitpunkt." Aber es gibt ein zeitlich begrenztes Angebot.',
      'Der beste Zeitpunkt anzufangen war gestern. Der zweitbeste ist jetzt.',
      'Jeder Tag, den du wartest, ist ein weiterer Tag ohne {benefit}.',
      'Dein zukünftiges Ich wird sich wünschen, du hättest heute angefangen.',
    ],
    need: [
      'Du denkst vielleicht, du brauchst das nicht. Aber {percentage}% unserer Kunden sagten dasselbe.',
      'Wenn du jemals {relatable_struggle} erlebt hast, ist das für dich.',
      'Du weißt nicht, was du verpasst, bis du es probierst.',
      'Das ist kein Wunsch. Es ist das Upgrade, auf das deine {routine} gewartet hat.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Platform-Specific Patterns
// ---------------------------------------------------------------------------

export const PLATFORM_PATTERNS = {
  meta: {
    maxChars: { headline: 40, primaryText: 125, description: 30 },
    bestPractices: [
      'Lead with benefit, not feature',
      'Use numbers and percentages',
      'Include social proof early',
      'End with clear CTA',
      'Emoji sparingly for emphasis',
    ],
    formatHints: {
      en: 'Use short paragraphs. Line breaks between ideas. Emoji for visual breaks.',
      de: 'Kurze Absätze. Zeilenumbrüche zwischen Ideen. Emoji für visuelle Trennung.',
    },
  },
  tiktok: {
    maxDuration: { short: 15, medium: 30, long: 60 },
    bestPractices: [
      'Hook in first 1-2 seconds',
      'Native feel, not polished',
      'Use trending sounds/formats',
      'Fast-paced editing',
      'Text overlays for key points',
    ],
    formatHints: {
      en: 'Conversational tone. Quick cuts. Relatable scenarios. Trend hooks.',
      de: 'Lockerer Ton. Schnelle Schnitte. Relatable Szenarien. Trend-Hooks.',
    },
  },
  google: {
    maxChars: { headline: 30, description: 90 },
    bestPractices: [
      'Include keywords naturally',
      'Use title case for headlines',
      'Include numbers/prices',
      'Strong CTA verbs',
      'Match search intent',
    ],
    formatHints: {
      en: 'Direct, keyword-rich. Match user intent. Highlight USPs.',
      de: 'Direkt, keyword-reich. Nutzerabsicht treffen. USPs hervorheben.',
    },
  },
  universal: {
    maxChars: { headline: 60, primaryText: 300, description: 150 },
    bestPractices: [
      'Adaptable across platforms',
      'Clear value proposition',
      'Emotional + rational appeal',
      'Tested CTA language',
    ],
    formatHints: {
      en: 'Balanced tone. Adaptable format. Clear structure.',
      de: 'Ausgewogener Ton. Anpassbares Format. Klare Struktur.',
    },
  },
};

// ---------------------------------------------------------------------------
// Tone Modifiers
// ---------------------------------------------------------------------------

export const TONE_MODIFIERS = {
  en: {
    Professional: {
      intensifiers: ['significantly', 'demonstrably', 'consistently', 'measurably'],
      style: 'formal',
      sentenceLength: 'medium',
      contractions: false,
    },
    Casual: {
      intensifiers: ['seriously', 'honestly', 'literally', 'basically'],
      style: 'conversational',
      sentenceLength: 'short',
      contractions: true,
    },
    Excited: {
      intensifiers: ['absolutely', 'incredibly', 'mind-blowingly', 'insanely'],
      style: 'enthusiastic',
      sentenceLength: 'short',
      contractions: true,
    },
    Empathetic: {
      intensifiers: ['truly', 'deeply', 'genuinely', 'meaningfully'],
      style: 'warm',
      sentenceLength: 'medium',
      contractions: true,
    },
    Authoritative: {
      intensifiers: ['definitively', 'unequivocally', 'conclusively', 'undeniably'],
      style: 'commanding',
      sentenceLength: 'medium',
      contractions: false,
    },
    Playful: {
      intensifiers: ['ridiculously', 'hilariously', 'outrageously', 'wildly'],
      style: 'fun',
      sentenceLength: 'short',
      contractions: true,
    },
    Luxury: {
      intensifiers: ['exquisitely', 'remarkably', 'impeccably', 'distinctly'],
      style: 'elevated',
      sentenceLength: 'long',
      contractions: false,
    },
  },
  de: {
    Professional: {
      intensifiers: ['deutlich', 'nachweislich', 'konsequent', 'messbar'],
      style: 'formal',
    },
    Casual: {
      intensifiers: ['echt', 'ehrlich', 'total', 'einfach'],
      style: 'locker',
    },
    Excited: {
      intensifiers: ['absolut', 'unglaublich', 'wahnsinnig', 'mega'],
      style: 'begeistert',
    },
    Empathetic: {
      intensifiers: ['wirklich', 'zutiefst', 'aufrichtig', 'von Herzen'],
      style: 'warm',
    },
    Authoritative: {
      intensifiers: ['eindeutig', 'unbestreitbar', 'nachweislich', 'definitiv'],
      style: 'bestimmend',
    },
    Playful: {
      intensifiers: ['absurd', 'irre', 'unfassbar', 'verrückt'],
      style: 'verspielt',
    },
    Luxury: {
      intensifiers: ['exquisit', 'bemerkenswert', 'makellos', 'erlesen'],
      style: 'gehoben',
    },
  },
};

// ---------------------------------------------------------------------------
// Angle / Framework Descriptions
// ---------------------------------------------------------------------------

export const ANGLE_DESCRIPTIONS = {
  en: [
    {
      name: 'Problem-Solution',
      description: 'Lead with your audience\'s biggest pain point, agitate the emotional weight of it, then position your product as the clear solution.',
      emotion: 'frustration -> relief',
      bestFor: 'Meta Ads, Google Ads',
      example: 'Tired of [problem]? [Product] changes everything.',
    },
    {
      name: 'Transformation Story',
      description: 'Paint a vivid before-and-after picture. Show the gap between current reality and desired outcome, with your product as the bridge.',
      emotion: 'aspiration, hope',
      bestFor: 'Instagram, TikTok, UGC',
      example: 'I went from [before] to [after] in just [time].',
    },
    {
      name: 'Social Proof Avalanche',
      description: 'Stack multiple forms of social proof — reviews, numbers, influencer mentions, awards — to create overwhelming credibility.',
      emotion: 'trust, FOMO',
      bestFor: 'Meta Ads, Landing Pages',
      example: 'Over 50,000 customers. 4.9 stars. Featured in Vogue.',
    },
    {
      name: 'Contrarian / Hot Take',
      description: 'Challenge a commonly held belief in your niche. The controversy stops the scroll and forces engagement.',
      emotion: 'curiosity, surprise',
      bestFor: 'TikTok, Twitter/X, Reels',
      example: 'Everything you\'ve been told about [topic] is wrong.',
    },
    {
      name: 'Us vs. Them',
      description: 'Position your product against competitors or old solutions. Highlight specific differences that matter to your audience.',
      emotion: 'confidence, superiority',
      bestFor: 'Google Ads, Meta Ads, Comparison Pages',
      example: 'While [competitors] use [inferior method], we use [superior method].',
    },
    {
      name: 'Urgency / Scarcity',
      description: 'Create time pressure or limited availability to push immediate action. Works best when the scarcity is real.',
      emotion: 'fear of missing out',
      bestFor: 'Meta Ads (BOFU), Email, SMS',
      example: 'Only [number] left. This offer expires at midnight.',
    },
  ],
  de: [
    {
      name: 'Problem-Lösung',
      description: 'Starte mit dem größten Schmerzpunkt deiner Zielgruppe, verstärke das emotionale Gewicht und positioniere dein Produkt als klare Lösung.',
      emotion: 'Frustration -> Erleichterung',
      bestFor: 'Meta Ads, Google Ads',
      example: 'Genug von [Problem]? [Produkt] verändert alles.',
    },
    {
      name: 'Transformations-Geschichte',
      description: 'Male ein lebhaftes Vorher-Nachher-Bild. Zeige die Lücke zwischen Realität und Wunsch, mit deinem Produkt als Brücke.',
      emotion: 'Aspiration, Hoffnung',
      bestFor: 'Instagram, TikTok, UGC',
      example: 'Ich ging von [vorher] zu [nachher] in nur [Zeit].',
    },
    {
      name: 'Social-Proof-Lawine',
      description: 'Stapele mehrere Social-Proof-Formen — Bewertungen, Zahlen, Influencer, Awards — für überwältigende Glaubwürdigkeit.',
      emotion: 'Vertrauen, FOMO',
      bestFor: 'Meta Ads, Landing Pages',
      example: 'Über 50.000 Kunden. 4,9 Sterne. Bekannt aus Vogue.',
    },
    {
      name: 'Kontroverse / Hot Take',
      description: 'Stelle eine verbreitete Meinung in deiner Nische in Frage. Die Kontroverse stoppt das Scrollen und erzwingt Engagement.',
      emotion: 'Neugier, Überraschung',
      bestFor: 'TikTok, Twitter/X, Reels',
      example: 'Alles, was man dir über [Thema] gesagt hat, ist falsch.',
    },
    {
      name: 'Wir vs. Die',
      description: 'Positioniere dein Produkt gegen Wettbewerber oder alte Lösungen. Hebe spezifische Unterschiede hervor, die deiner Zielgruppe wichtig sind.',
      emotion: 'Selbstbewusstsein, Überlegenheit',
      bestFor: 'Google Ads, Meta Ads, Vergleichsseiten',
      example: 'Während [Wettbewerber] [schlechte Methode] nutzen, setzen wir auf [bessere Methode].',
    },
    {
      name: 'Dringlichkeit / Knappheit',
      description: 'Erzeuge Zeitdruck oder begrenzte Verfügbarkeit für sofortiges Handeln. Funktioniert am besten bei echter Knappheit.',
      emotion: 'Angst, etwas zu verpassen',
      bestFor: 'Meta Ads (BOFU), E-Mail, SMS',
      example: 'Nur noch [Anzahl] verfügbar. Angebot endet um Mitternacht.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Names for social proof randomization
// ---------------------------------------------------------------------------

export const CUSTOMER_NAMES = {
  en: ['Sarah M.', 'Jessica T.', 'Amanda R.', 'Emily K.', 'Rachel L.', 'Lisa P.', 'Hannah B.', 'Olivia S.', 'Sophie W.', 'Megan D.', 'David R.', 'Michael T.', 'Chris P.', 'James L.'],
  de: ['Anna M.', 'Lisa T.', 'Sarah K.', 'Laura B.', 'Julia S.', 'Marie W.', 'Lena H.', 'Sophie R.', 'Nina P.', 'Katharina D.', 'Thomas M.', 'Stefan K.', 'Markus B.', 'Daniel W.'],
};
