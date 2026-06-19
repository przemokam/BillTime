import { getProjects, getCompanies } from "@/lib/queries";
import { ProjectsManager } from "@/components/projects/ProjectsManager";

export default async function ProjectsPage() {
  const [projects, companies] = await Promise.all([getProjects(true), getCompanies()]);
  return (
    <ProjectsManager
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        companyId: p.companyId,
        companyName: p.company?.name ?? null,
        rateCents: p.rateCents,
        currency: p.currency,
        color: p.color,
        repoPathsJson: p.repoPathsJson,
        isArchived: p.isArchived,
      }))}
      companies={companies.map((c) => ({ id: c.id, name: c.name, projectCount: c._count.projects }))}
    />
  );
}
