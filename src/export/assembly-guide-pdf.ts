import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { AssemblyGuide } from '../assembly/guide'
import { PDF_POINTS_PER_MM } from './pdf'

export async function createAssemblyGuidePdf(
  guide: AssemblyGuide,
  title = 'Paper Studio assembly guide',
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('Paper Studio')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pageWidth = 210 * PDF_POINTS_PER_MM
  const pageHeight = 297 * PDF_POINTS_PER_MM
  const margin = 18 * PDF_POINTS_PER_MM
  const lineHeight = 16
  const stepsPerPage = 28
  const pageCount = Math.max(1, Math.ceil(guide.steps.length / stepsPerPage))

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([pageWidth, pageHeight])
    page.drawText(title, {
      x: margin,
      y: pageHeight - margin,
      size: 16,
      font,
      color: rgb(0.12, 0.2, 0.32),
    })
    page.drawText(`Root face: ${guide.rootFaceId}`, {
      x: margin,
      y: pageHeight - margin - 24,
      size: 10,
      font,
      color: rgb(0.25, 0.3, 0.38),
    })
    const firstStep = pageIndex * stepsPerPage
    const pageSteps = guide.steps.slice(firstStep, firstStep + stepsPerPage)
    pageSteps.forEach((step, index) => {
      const text = `${step.index + 1}. Fold ${step.faceId} onto ${step.parentFaceId} along ${step.edgeId} (${step.angleDegrees.toFixed(1)} deg).`
      page.drawText(text, {
        x: margin,
        y: pageHeight - margin - 52 - index * lineHeight,
        size: 9,
        font,
        color: rgb(0.18, 0.22, 0.29),
        maxWidth: pageWidth - margin * 2,
      })
    })
    const warningY = margin + (pageIndex === pageCount - 1 ? 20 : 0)
    page.drawText(
      'Idealized zero-thickness fold sequence. Physical paper assembly, adhesive behavior, and collision clearance are not validated.',
      {
        x: margin,
        y: warningY,
        size: 8,
        font,
        color: rgb(0.65, 0.32, 0.08),
        maxWidth: pageWidth - margin * 2,
      },
    )
    page.drawText(`Page ${pageIndex + 1}/${pageCount}`, {
      x: pageWidth - margin - 55,
      y: margin,
      size: 8,
      font,
      color: rgb(0.35, 0.38, 0.42),
    })
  }
  return pdf.save()
}
