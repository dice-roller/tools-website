export interface Tool {
  id: string;
  title: string;
  description: string;
  icon: string;
  path?: string;
  status?: "Coming soon" | "Planned";
}

export const tools: readonly Tool[] = [
  {
    id: "converter",
    path: "/converter",
    title: "Data converter",
    description:
      "Convert exported rolls and histories between supported data versions and formats.",
    icon: "i-heroicons-arrows-right-left",
  },
  {
    id: "playground",
    title: "Dice playground",
    description:
      "An advanced interactive roller with configurable presenters, random number generators, variables and limits.",
    icon: "i-lucide-dices",
    status: "Planned",
  },
  {
    id: "ast",
    title: "AST explorer",
    description:
      "Enter dice notation and explore its parsed abstract syntax tree (AST) to see how expressions are structured.",
    icon: "i-lucide-braces",
    status: "Planned",
  },
];

export const documentationUrl = "https://dice-roller.github.io/documentation/";
export const repositoryUrl = "https://github.com/dice-roller/tools-website";
