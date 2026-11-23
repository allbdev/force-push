/** English (default). Written, not translated: the joke has to land on its own. */
const en = {
  meta: {
    title: "Force Push",
    description:
      "A turf war in an open-plan office. Your bomb is a git push --force: the blast paints the floor in your branch's colour.",
  },
  lang: {
    switchTo: "Mudar para português",
    short: "PT",
  },
  landing: {
    ours: "<<<<<<< HEAD",
    theirs: ">>>>>>> origin/everyone",
    title1: "Force",
    title2: "Push",
    pitch:
      "A turf war in an open-plan office. Your bomb is a {command}: the blast paints the floor in your branch's colour. Whoever owns the most code when the sprint ends wins.",
    command: "git push --force",
    facts: "2 to 4 players · 3 minutes · free · open source",
    soon: "Still in review. The first playable build is on its way.",
    source: "Source code",
  },
};

/** Every locale has exactly this shape (a test checks keys and slots). */
export type LocaleDict = typeof en;
export default en;
