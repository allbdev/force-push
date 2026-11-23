import type { LocaleDict } from "./en";

/** Português do Brasil. Git words stay git words: push, force-push, revert, merge, main. */
const ptBR: LocaleDict = {
  meta: {
    title: "Force Push",
    description:
      "Guerra de território no open space. Sua bomba é um git push --force: a explosão pinta o chão com a cor da sua branch.",
  },
  lang: {
    switchTo: "Switch to English",
    short: "EN",
  },
  landing: {
    ours: "<<<<<<< HEAD",
    theirs: ">>>>>>> origin/todo-mundo",
    title1: "Force",
    title2: "Push",
    pitch:
      "Guerra de território no open space. Sua bomba é um {command}: a explosão pinta o chão com a cor da sua branch. Ganha quem for dono de mais código no fim da sprint.",
    command: "git push --force",
    facts: "2 a 4 jogadores · 3 minutos · grátis · código aberto",
    soon: "Ainda em code review. A primeira versão jogável está a caminho.",
    source: "Código-fonte",
  },
};

export default ptBR;
