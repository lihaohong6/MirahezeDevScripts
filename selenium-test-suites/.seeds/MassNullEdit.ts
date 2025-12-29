import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedMassNullEdit(operations: SeedingWikipageOperations) {
  for (let j = 0; j < 20; j++) {
    seedPage(operations, {
      title: `MassNullEdit ${j+1}`,
      additionalDescription: '\n\n[[Category:MassNullEdit]]'
    });
  }
}