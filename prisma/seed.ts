import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  // Clean slate (dev seed).
  await db.timeEntry.deleteMany();
  await db.weekdayDefault.deleteMany();
  await db.project.deleteMany();
  await db.company.deleteMany();
  await db.setting.deleteMany();
  await db.activeTimer.deleteMany();

  const acme = await db.company.create({
    data: { name: "Acme Inc.", note: "Main client" },
  });
  const globex = await db.company.create({ data: { name: "Globex" } });

  const now = new Date();
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  const project = await db.project.create({
    data: {
      name: `Acme ${monthLabel}`,
      companyId: acme.id,
      rateCents: 4500, // 45,00 EUR/h
      currency: "EUR",
      color: "yellow",
      repoPathsJson: JSON.stringify([
        "/Users/me/projects/acme-web",
        "/Users/me/projects/acme-api",
      ]),
    },
  });

  await db.project.create({
    data: {
      name: "Globex Platform",
      companyId: globex.id,
      rateCents: 6000,
      currency: "EUR",
      color: "cyan",
    },
  });

  // Default description on weekdays (Mon..Fri = 1..5): "Consulting" (global rule).
  for (let wd = 1; wd <= 5; wd++) {
    await db.weekdayDefault.create({
      data: { weekday: wd, projectId: null, description: "Consulting" },
    });
  }

  // A handful of sample entries on recent weekdays of this month.
  const samples = [
    { desc: "Consulting: web app auth fixes", from: 540, to: 810 },
    { desc: "Consulting: bug fixes and review", from: 615, to: 960 },
    { desc: "Consulting: feature work and planning", from: 570, to: 885 },
  ];
  const d = new Date(now);
  let placed = 0;
  let cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  while (placed < samples.length) {
    const wd = cursor.getDay();
    if (wd >= 1 && wd <= 5 && cursor.getMonth() === now.getMonth()) {
      const s = samples[placed];
      await db.timeEntry.create({
        data: {
          date: dateKey(cursor),
          projectId: project.id,
          description: s.desc,
          startMin: s.from,
          endMin: s.to,
          source: "manual",
        },
      });
      placed++;
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
    if (cursor.getMonth() !== now.getMonth()) break;
  }

  await db.setting.createMany({
    data: [
      { key: "defaultCurrency", value: "EUR" },
      { key: "ccIdleGapMin", value: "10" },
      { key: "reportAuthorName", value: "" },
    ],
  });

  console.log(`Seeded: 2 companies, 2 projects, 5 weekday rules, ${placed} entries.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
