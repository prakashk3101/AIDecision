import { Calculator, Coins, SlidersHorizontal } from 'lucide-react'
import type { TokenUsage } from './catalog/modelCatalog'
import type { DecisionResult } from './domain/decisionEngine'
import type { OptimizationScenario } from './cost/tokenOptimizationEngine'
import ModelSearch from './ModelSearch'
import TokenOptimization from './TokenOptimization'
import WhatIfSimulator, { type WhatIfScenario } from './WhatIfSimulator'

type CostOptimizationView = 'scenario' | 'tokens' | 'models'

type Props = {
  decision: DecisionResult
  modelDecision?: DecisionResult | null
  view: CostOptimizationView
  onViewChange: (view: CostOptimizationView) => void
  onScenarioApply: (scenario: WhatIfScenario) => void
  selectedModelId?: string
  onSelectModel: (modelId: string) => void
  onApplyOptimization: (scenario: OptimizationScenario, usage: TokenUsage) => void
}

export default function CostOptimization({ decision, modelDecision, view, onViewChange, onScenarioApply, selectedModelId, onSelectModel, onApplyOptimization }: Props) {
  return <section className="cost-optimization-workspace">
    <div className="cost-optimization-tabs" role="tablist" aria-label="Cost optimization views">
      <button role="tab" aria-selected={view === 'scenario'} className={view === 'scenario' ? 'active' : ''} onClick={() => onViewChange('scenario')}><SlidersHorizontal size={17} /> What-If Scenario</button>
      <button role="tab" aria-selected={view === 'tokens'} className={view === 'tokens' ? 'active' : ''} onClick={() => onViewChange('tokens')}><Coins size={17} /> Token Optimizer</button>
      <button role="tab" aria-selected={view === 'models'} className={view === 'models' ? 'active' : ''} onClick={() => onViewChange('models')}><Calculator size={17} /> Model Cost & Selection</button>
    </div>
    {view === 'scenario'
      ? <WhatIfSimulator decision={decision} onClose={() => onViewChange('models')} onScenarioApply={onScenarioApply} />
      : view === 'tokens'
        ? <TokenOptimization decision={decision} onApply={onApplyOptimization} />
        : <ModelSearch costFocused decision={modelDecision ?? decision} selectedModelId={selectedModelId} onSelectModel={onSelectModel} />}
  </section>
}
