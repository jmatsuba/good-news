import { PrismaClient, ArticleStatus } from "@prisma/client";

const prisma = new PrismaClient();

const tags = [
  { slug: "tech", label: "Tech" },
  { slug: "animals", label: "Animals" },
  { slug: "health", label: "Health" },
  { slug: "politics", label: "Politics" },
  { slug: "environment", label: "Environment" },
  { slug: "science", label: "Science" },
];

async function main() {
  for (const t of tags) {
    await prisma.tag.upsert({
      where: { slug: t.slug },
      create: t,
      update: { label: t.label },
    });
  }

  const tech = await prisma.tag.findUniqueOrThrow({ where: { slug: "tech" } });
  const science = await prisma.tag.findUniqueOrThrow({ where: { slug: "science" } });
  const health = await prisma.tag.findUniqueOrThrow({ where: { slug: "health" } });

  const samples = [
    {
      title: "Open-source tool helps cities track urban heat islands",
      summary:
        "A lightweight dashboard piloted in three regions helps planners see where tree cover and cool surfaces matter most.",
      url: "https://example.com/good-news/urban-heat",
      sourceName: "Demo Source",
      publishedAt: new Date(),
      imageUrl: null as string | null,
      positivity: 8,
      sensationalism: 2,
      politicalControversy: 2,
      fitScore: 8,
      status: ArticleStatus.PUBLISHED,
      highlighted: true,
      tagIds: [tech.id, science.id],
    },
    {
      title: "Community clinic expands weekend hours after volunteer drive",
      summary:
        "Local nurses and translators coordinated to add Saturday appointments without raising fees for patients.",
      url: "https://example.com/good-news/clinic-hours",
      sourceName: "Demo Source",
      publishedAt: new Date(Date.now() - 3600_000),
      imageUrl: null,
      positivity: 8,
      sensationalism: 2,
      politicalControversy: 1,
      fitScore: 8,
      status: ArticleStatus.PUBLISHED,
      highlighted: true,
      tagIds: [health.id],
    },
    {
      title: "Students build low-cost sensors to monitor air quality",
      summary:
        "A classroom project turned into a neighborhood network sharing open data with families and teachers.",
      url: "https://example.com/good-news/air-sensors",
      sourceName: "Demo Source",
      publishedAt: new Date(Date.now() - 7200_000),
      imageUrl: null,
      positivity: 7,
      sensationalism: 3,
      politicalControversy: 2,
      fitScore: 7,
      status: ArticleStatus.PUBLISHED,
      highlighted: false,
      tagIds: [tech.id],
    },
  ];

  for (const s of samples) {
    const { tagIds, ...data } = s;
    const article = await prisma.article.upsert({
      where: { url: data.url },
      create: data,
      update: {
        title: data.title,
        summary: data.summary,
        sourceName: data.sourceName,
        publishedAt: data.publishedAt,
        positivity: data.positivity,
        sensationalism: data.sensationalism,
        politicalControversy: data.politicalControversy,
        fitScore: data.fitScore,
        status: data.status,
        highlighted: data.highlighted,
      },
    });
    await prisma.articleTag.deleteMany({ where: { articleId: article.id } });
    await prisma.articleTag.createMany({
      data: tagIds.map((tagId) => ({ articleId: article.id, tagId })),
    });
  }

  console.log("Seed complete: tags + sample articles.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
