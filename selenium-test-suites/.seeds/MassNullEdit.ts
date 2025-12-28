import { seedPage } from "./utils.ts";

export function seedMassNullEdit(pages: Map<string, string>) {
  for (let j = 0; j < 20; j++) {
    seedPage(pages, {
      title: `MassNullEdit`,
      n: j+1,
      additionalDescription: '\n\n[[Category:MassNullEdit]]'
    });
  }
}