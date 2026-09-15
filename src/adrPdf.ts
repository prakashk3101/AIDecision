import { jsPDF } from 'jspdf'
import type { DecisionResult, EvaluatedCandidate } from './domain/decisionEngine'

const colors = {
  navy: [9, 45, 92] as const,
  blue: [18, 101, 237] as const,
  green: [25, 135, 84] as const,
  ink: [29, 43, 67] as const,
  muted: [100, 116, 139] as const,
  line: [218, 226, 236] as const,
  panel: [246, 249, 253] as const,
  white: [255, 255, 255] as const,
}

const money = (value: number) => Number.isFinite(value) ? `$${Math.round(value).toLocaleString()}` : 'Unavailable'
const statusText = (status: EvaluatedCandidate['status']) => status === 'eligible' ? 'Eligible' : status === 'partiallyEligible' ? 'Partially eligible' : 'Not eligible'

export function buildAdrPdf(decision: DecisionResult, selected: EvaluatedCandidate) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  const footerTop = pageHeight - 13
  let cursorY = 24

  const addHeader = () => {
    pdf.setFillColor(...colors.navy)
    pdf.rect(0, 0, pageWidth, 15, 'F')
    pdf.setTextColor(...colors.white)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('AI ARCHITECT', margin, 9.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text('Architecture Decision Record', pageWidth - margin, 9.5, { align: 'right' })
  }

  const ensureSpace = (height: number) => {
    if (cursorY + height <= footerTop) return false
    pdf.addPage()
    addHeader()
    cursorY = 24
    return true
  }

  const sectionTitle = (title: string) => {
    ensureSpace(20)
    pdf.setDrawColor(...colors.blue)
    pdf.setLineWidth(.8)
    pdf.line(margin, cursorY, margin, cursorY + 7)
    pdf.setTextColor(...colors.ink)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(title, margin + 4, cursorY + 5.5)
    cursorY += 11
  }

  const paragraph = (text: string, options: { bold?: boolean; color?: readonly [number, number, number]; indent?: number } = {}) => {
    const indent = options.indent ?? 0
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...(options.color ?? colors.ink))
    const lines = pdf.splitTextToSize(text || 'Not specified', contentWidth - indent)
    ensureSpace(lines.length * 4.5 + 2)
    pdf.text(lines, margin + indent, cursorY)
    cursorY += lines.length * 4.5 + 2
  }

  const bulletList = (items: string[]) => {
    if (!items.length) {
      paragraph('None specified', { color: colors.muted })
      return
    }
    for (const item of items) {
      const lines = pdf.splitTextToSize(item, contentWidth - 8)
      ensureSpace(lines.length * 4.5 + 1.5)
      pdf.setFillColor(...colors.blue)
      pdf.circle(margin + 1.5, cursorY - 1.2, .7, 'F')
      pdf.setTextColor(...colors.ink)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(lines, margin + 5, cursorY)
      cursorY += lines.length * 4.5 + 1.5
    }
  }

  const keyValues = (items: Array<[string, string]>) => {
    for (const [label, value] of items) {
      const valueLines = pdf.splitTextToSize(value || 'Not specified', contentWidth - 54)
      const rowHeight = Math.max(8, valueLines.length * 4.2 + 3)
      ensureSpace(rowHeight)
      pdf.setFillColor(...colors.panel)
      pdf.roundedRect(margin, cursorY, contentWidth, rowHeight - 1, 1.5, 1.5, 'F')
      pdf.setFontSize(8)
      pdf.setTextColor(...colors.muted)
      pdf.setFont('helvetica', 'bold')
      pdf.text(label.toUpperCase(), margin + 3, cursorY + 5)
      pdf.setTextColor(...colors.ink)
      pdf.setFont('helvetica', 'normal')
      pdf.text(valueLines, margin + 51, cursorY + 5)
      cursorY += rowHeight
    }
  }

  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const prepareRow = (cells: string[]) => {
      const wrapped = cells.map((cell, index) => pdf.splitTextToSize(cell, widths[index] - 4))
      const rowHeight = Math.max(8, ...wrapped.map(lines => lines.length * 4 + 3))
      return { wrapped, rowHeight }
    }
    const paintRow = ({ wrapped, rowHeight }: ReturnType<typeof prepareRow>, header = false, shaded = false) => {
      const fillColor = header ? colors.navy : colors.white
      const textColor = header ? colors.white : colors.ink
      pdf.setDrawColor(...colors.line)
      let x = margin
      wrapped.forEach((lines, index) => {
        const cellFill = shaded && !header ? colors.panel : fillColor
        pdf.setFillColor(cellFill[0], cellFill[1], cellFill[2])
        pdf.rect(x, cursorY, widths[index], rowHeight, 'FD')
        pdf.setTextColor(textColor[0], textColor[1], textColor[2])
        pdf.setFont('helvetica', header ? 'bold' : 'normal')
        pdf.setFontSize(header ? 7.5 : 8)
        pdf.text(lines, x + 2, cursorY + 5)
        x += widths[index]
      })
      cursorY += rowHeight
    }
    const preparedHeader = prepareRow(headers)
    ensureSpace(preparedHeader.rowHeight)
    paintRow(preparedHeader, true)
    rows.forEach((row, index) => {
      const preparedRow = prepareRow(row)
      if (ensureSpace(preparedRow.rowHeight)) {
        paintRow(preparedHeader, true)
        ensureSpace(preparedRow.rowHeight)
      }
      paintRow(preparedRow, false, index % 2 === 1)
    })
    cursorY += 3
  }

  addHeader()
  pdf.setTextColor(...colors.navy)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  const titleLines = pdf.splitTextToSize(decision.profile.name, contentWidth - 35)
  pdf.text(titleLines, margin, cursorY)
  cursorY += titleLines.length * 8 + 3
  pdf.setTextColor(...colors.muted)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`ADR | ${new Date(decision.generatedAt).toLocaleDateString()} | Status: DRAFT - Architect review required`, margin, cursorY)
  cursorY += 8

  pdf.setFillColor(...colors.panel)
  pdf.roundedRect(margin, cursorY, contentWidth, 30, 2, 2, 'F')
  pdf.setTextColor(...colors.muted)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DECISION', margin + 4, cursorY + 6)
  pdf.setTextColor(...colors.navy)
  pdf.setFontSize(14)
  pdf.text(selected.name, margin + 4, cursorY + 13)
  pdf.setTextColor(...colors.ink)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`${selected.platformProvider} | ${statusText(selected.status)} | Confidence ${decision.confidence}% (${decision.confidenceLabel})`, margin + 4, cursorY + 20)
  pdf.setTextColor(...colors.green)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${money(selected.monthlyCost.expected)} expected monthly cost`, margin + 4, cursorY + 26)
  cursorY += 37

  sectionTitle('1. Context')
  paragraph(decision.profile.problem)

  sectionTitle('2. Architecture-Significant Requirements')
  keyValues([
    ['Scale', decision.profile.scale],
    ['AI requirement', decision.profile.aiRequirement],
    ['Latency objective', `P95 within ${decision.profile.latencySlaMs.toLocaleString()} ms`],
    ['Demand', `${decision.profile.monthlyRequests} monthly; ${Math.ceil(decision.profile.peakRequestsPerSecond)} requests/second peak`],
    ['Data sensitivity', decision.profile.sensitivity],
    ['Compliance', decision.profile.compliance.join(', ') || 'None specified'],
    ['Security controls', decision.profile.securityRequirements.join(', ') || 'Standard controls'],
    ['Integrations', decision.profile.integrations || 'None specified'],
  ])

  sectionTitle('3. Decision')
  paragraph(`Adopt ${selected.name} (${selected.pattern}) on ${selected.platformProvider}. The selected option is ${statusText(selected.status).toLowerCase()} under the mandatory requirement gates${selected.status !== 'eligible' ? ', subject to the exceptions documented below' : ''}.`)
  bulletList(selected.status === 'eligible' ? selected.strengths : selected.rejectionReasons)

  sectionTitle('4. Solution Components')
  table(
    ['Component', 'Platform service', 'Requirement served'],
    selected.technologies.map(item => [item.component, item.product, `${item.functionalRequirement}. ${item.nonFunctionalRequirement}.`]),
    [42, 50, contentWidth - 92],
  )

  sectionTitle('5. Requirement Fit and Evidence')
  table(
    ['Requirement', 'Status', 'Evidence'],
    selected.requirementFit.map(item => [item.requirement, item.status, item.explanation]),
    [50, 20, contentWidth - 70],
  )

  sectionTitle('6. Cost Estimate')
  keyValues([
    ['Low estimate', `${money(selected.monthlyCost.low)} / month`],
    ['Expected estimate', `${money(selected.monthlyCost.expected)} / month`],
    ['High estimate', `${money(selected.monthlyCost.high)} / month`],
    ['Pricing basis', 'Deterministic catalog estimate; validate against regional provider pricing and measured usage before approval'],
  ])
  table(
    ['Cost area', 'Monthly estimate'],
    Object.entries(selected.monthlyCost.breakdown).map(([label, value]) => [label, money(value)]),
    [contentWidth * .65, contentWidth * .35],
  )

  sectionTitle('7. Alternatives Considered')
  table(
    ['Architecture', 'Status', 'Expected cost', 'Primary constraint'],
    decision.candidates.filter(candidate => candidate.id !== selected.id).map(candidate => [
      candidate.name,
      statusText(candidate.status),
      money(candidate.monthlyCost.expected),
      candidate.status === 'eligible' ? candidate.weaknesses[0] ?? 'No material constraint recorded' : (candidate.rejectionReasons[0] ?? candidate.gates.unknownGates[0] ?? 'No material constraint recorded'),
    ]),
    [38, 24, 28, contentWidth - 90],
  )

  sectionTitle('8. Risks and Mitigations')
  table(
    ['Severity', 'Risk', 'Mitigation'],
    decision.risks.map(risk => [risk.severity, risk.title, risk.mitigation]),
    [22, 48, contentWidth - 70],
  )

  sectionTitle('9. Trade-offs and Consequences')
  if (decision.tradeOffs.length) {
    bulletList(decision.tradeOffs.map(item => `${item.dimension}: ${item.sacrifice} Alternative: ${item.alternative}.`))
  } else {
    paragraph('No material trade-off was identified against eligible alternatives.', { color: colors.muted })
  }
  paragraph(`Consequences: the team accepts the operational characteristics, cost range, and delivery complexity of ${selected.name}. Recalculate this ADR when requirements, catalog evidence, or provider pricing change.`)

  sectionTitle('10. Assumptions and Approval')
  bulletList(decision.profile.assumptions)
  ensureSpace(20)
  pdf.setDrawColor(...colors.line)
  pdf.line(margin, cursorY + 10, margin + 72, cursorY + 10)
  pdf.line(pageWidth - margin - 72, cursorY + 10, pageWidth - margin, cursorY + 10)
  pdf.setTextColor(...colors.muted)
  pdf.setFontSize(8)
  pdf.text('Architecture owner / Date', margin, cursorY + 15)
  pdf.text('Business owner / Date', pageWidth - margin - 72, cursorY + 15)

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setDrawColor(...colors.line)
    pdf.line(margin, footerTop, pageWidth - margin, footerTop)
    pdf.setTextColor(...colors.muted)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text(`${decision.profile.name} | Architecture Decision Record`, margin, footerTop + 5)
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, footerTop + 5, { align: 'right' })
  }

  const filename = `${decision.profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-adr.pdf`
  return { pdf, filename }
}

export function generateAdrPdf(decision: DecisionResult, selected: EvaluatedCandidate) {
  const { pdf, filename } = buildAdrPdf(decision, selected)
  pdf.save(filename)
}