import { getPrismaClient } from '@cwm/db'
import { ProjectSchema, type ProjectInput } from '@cwm/config'

export class ProjectsService {
  private get db() {
    return getPrismaClient()
  }

  async list() {
    return this.db.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: { vpsServer: true, claudeAccount: true },
    })
  }

  async findById(id: string) {
    const project = await this.db.project.findUnique({
      where: { id },
      include: { vpsServer: true, claudeAccount: true },
    })
    if (!project) throw new Error(`Projeto não encontrado: ${id}`)
    return project
  }

  async create(input: ProjectInput) {
    const data = ProjectSchema.parse(input)
    return this.db.project.create({
      data,
      include: { vpsServer: true, claudeAccount: true },
    })
  }

  async update(id: string, input: Partial<ProjectInput>) {
    await this.findById(id)
    const data = ProjectSchema.partial().parse(input)
    return this.db.project.update({
      where: { id },
      data,
      include: { vpsServer: true, claudeAccount: true },
    })
  }

  async delete(id: string) {
    await this.findById(id)
    return this.db.project.delete({ where: { id } })
  }

  async getRecent(limit = 5) {
    return this.db.launchHistory.findMany({
      take: limit,
      orderBy: { launchedAt: 'desc' },
      include: { project: { include: { vpsServer: true } } },
      distinct: ['projectId'],
    })
  }
}
