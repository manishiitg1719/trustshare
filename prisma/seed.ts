import { resetDemo } from "../src/lib/shared/seed";
import { db } from "../src/lib/shared/db";

resetDemo()
  .then(() => console.log("Demo data loaded"))
  .finally(() => db.$disconnect());
