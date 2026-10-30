import { ArrowUpRight } from 'lucide-react'
import { SolidThumbnail } from './SolidThumbnail'
import { templates, templateProject } from './templates'
import type { PaperStudioProject } from '../project/project-file'
export function TemplateGallery({
  onOpen,
}: {
  onOpen: (project: PaperStudioProject) => void
}) {
  return (
    <section id="templates" className="home-section" data-motion-reveal>
      <div className="home-section-heading">
        <div>
          <span className="home-eyebrow">START WITH A SHAPE</span>
          <h2>작은 형태, 무한한 가능성</h2>
        </div>
        <span>
          기본 템플릿 <b>04</b>
        </span>
      </div>
      <div className="home-template-grid">
        {templates.map((template, index) => (
          <button
            className="home-template"
            data-motion-reveal
            data-motion-magnet
            key={template.kind}
            onClick={() => onOpen(templateProject(template.kind))}
          >
            <div className="home-template-art">
              <span>0{index + 1}</span>
              <SolidThumbnail project={templateProject(template.kind)} />
              <span className="home-template-open">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <div className="home-template-info">
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <small>{template.dimensions}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
