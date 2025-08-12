'use client'

import { useState } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge, Select } from '@/components/ui'
import { 
  CreateExpertSessionRequest, 
  UpdateExpertSessionRequest, 
  ExpertSession, 
  Currency,
  EXPERT_SESSION_CONSTRAINTS,
  DURATION_OPTIONS,
  COMMON_TOPIC_TAGS,
  SESSION_LEVEL_DESCRIPTIONS,
  validateExpertSession,
  formatSessionPrice,
  calculateHourlyRate
} from '@/types/expert-sessions'

interface ExpertSessionFormProps {
  session?: ExpertSession
  onSubmit: (data: CreateExpertSessionRequest | UpdateExpertSessionRequest) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  mode: 'create' | 'edit'
}

export function ExpertSessionForm({ 
  session, 
  onSubmit, 
  onCancel, 
  isLoading = false, 
  mode 
}: ExpertSessionFormProps) {
  const [formData, setFormData] = useState({
    title: session?.title || '',
    short_description: session?.short_description || '',
    topic_tags: session?.topic_tags || [],
    duration_minutes: session?.duration_minutes || 60,
    price_amount: session?.price_amount || 0,
    currency: (session?.currency || 'DKK') as Currency,
    level: session?.level || undefined,
    prerequisites: session?.prerequisites || '',
    materials_url: session?.materials_url || '',
  })

  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [priceDisplayValue, setPriceDisplayValue] = useState(
    session ? (session.price_amount / 100).toString() : '0'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    const validation = validateExpertSession(formData)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    setErrors([])
    
    try {
      const submitData = {
        ...formData,
        prerequisites: formData.prerequisites.trim() || undefined,
        materials_url: formData.materials_url.trim() || undefined,
      }
      
      await onSubmit(submitData)
    } catch (error) {
      console.error('Form submission error:', error)
      setErrors(['Failed to save session. Please try again.'])
    }
  }

  const addTag = (tagText: string) => {
    const tag = tagText.trim()
    if (tag && !formData.topic_tags.includes(tag) && formData.topic_tags.length < EXPERT_SESSION_CONSTRAINTS.MAX_TOPIC_TAGS) {
      setFormData(prev => ({
        ...prev,
        topic_tags: [...prev.topic_tags, tag]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      topic_tags: prev.topic_tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const updateField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // Clear the "0" when user starts typing
    if (priceDisplayValue === '0' && value.length > 0 && value !== '0') {
      setPriceDisplayValue(value)
    } else {
      setPriceDisplayValue(value)
    }
    
    // Convert to minor units (multiply by 100) for storage
    const priceInMinorUnits = value === '' || value === '0' ? 0 : Math.round(parseFloat(value) * 100) || 0
    updateField('price_amount', priceInMinorUnits)
  }

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value as Currency
    updateField('currency', newCurrency)
  }

  // Get currency symbol for display
  const getCurrencySymbol = (currency: Currency) => {
    switch (currency) {
      case 'DKK': return 'kr.'
      case 'USD': return '$'
      case 'EUR': return '€'
      default: return 'kr.'
    }
  }

  // Calculate hourly rate for display
  const hourlyRate = formData.price_amount > 0 && formData.duration_minutes > 0 
    ? calculateHourlyRate(formData.price_amount, formData.duration_minutes, formData.currency)
    : null

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Create New Session' : 'Edit Session'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-red-800 font-medium mb-2">Please fix the following errors:</h4>
              <ul className="text-red-700 text-sm space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <Input
              label="Session Title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g., Prompting for Analysts"
              maxLength={EXPERT_SESSION_CONSTRAINTS.TITLE_MAX_LENGTH}
              required
            />
            
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.short_description}
                onChange={(e) => updateField('short_description', e.target.value)}
                placeholder="Describe what learners will gain from this session..."
                maxLength={EXPERT_SESSION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH}
                rows={4}
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.short_description.length}/{EXPERT_SESSION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
          </div>

          {/* Topic Tags */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Topic Tags</h3>
            
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.topic_tags.map(tag => (
                <Badge 
                  key={tag} 
                  variant="neutral" 
                  className="cursor-pointer hover:bg-red-100"
                  onClick={() => removeTag(tag)}
                >
                  {tag} ×
                </Badge>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a topic tag..."
                maxLength={EXPERT_SESSION_CONSTRAINTS.TOPIC_TAG_MAX_LENGTH}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag(newTag)
                  }
                }}
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => addTag(newTag)}
                disabled={!newTag.trim() || formData.topic_tags.length >= EXPERT_SESSION_CONSTRAINTS.MAX_TOPIC_TAGS}
              >
                Add
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 mr-2">Common tags:</span>
              {COMMON_TOPIC_TAGS.slice(0, 8).map(tag => (
                <button
                  key={tag}
                  type="button"
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  onClick={() => addTag(tag)}
                  disabled={formData.topic_tags.includes(tag) || formData.topic_tags.length >= EXPERT_SESSION_CONSTRAINTS.MAX_TOPIC_TAGS}
                >
                  {tag}
                </button>
              ))}
            </div>
            
            <p className="text-sm text-gray-500">
              {formData.topic_tags.length}/{EXPERT_SESSION_CONSTRAINTS.MAX_TOPIC_TAGS} tags
            </p>
          </div>

          {/* Session Details */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Session Details</h3>
              
              <Select
                label="Duration"
                value={formData.duration_minutes.toString()}
                onChange={(e) => updateField('duration_minutes', parseInt(e.target.value))}
                required
              >
                {DURATION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              
              <Select
                label="Level"
                value={formData.level || ''}
                onChange={(e) => updateField('level', e.target.value || undefined)}
              >
                <option value="">Optional - Select level</option>
                {Object.entries(SESSION_LEVEL_DESCRIPTIONS).map(([level, description]) => (
                  <option key={level} value={level}>
                    {level} - {description}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Pricing</h3>
              
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    label="Price"
                    type="number"
                    value={priceDisplayValue}
                    onChange={handlePriceChange}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        setPriceDisplayValue('')
                      }
                    }}
                    placeholder="Enter amount"
                    min="0"
                    step="0.01"
                    required
                    className="pr-12"
                  />
                  <div className="absolute right-3 top-[38px] text-sm text-gray-500 pointer-events-none">
                    {getCurrencySymbol(formData.currency)}
                  </div>
                </div>
                
                <Select
                  label="Currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value as Currency)}
                  className="w-full"
                >
                  <option value="DKK">DKK (Danish Kroner)</option>
                  <option value="USD">USD (US Dollars)</option>
                  <option value="EUR">EUR (Euros)</option>
                </Select>
              </div>
              
              {formData.price_amount > 0 && (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Session price: {formatSessionPrice(formData.price_amount, formData.currency)}</p>
                  {hourlyRate && <p>Hourly rate: {hourlyRate}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Additional Information</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">Prerequisites (optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.prerequisites}
                onChange={(e) => updateField('prerequisites', e.target.value)}
                placeholder="What should learners know before booking this session?"
                rows={3}
              />
            </div>
            
            <Input
              label="Materials URL (optional)"
              type="url"
              value={formData.materials_url}
              onChange={(e) => updateField('materials_url', e.target.value)}
              placeholder="https://... link to preparation materials"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t">
            {onCancel && (
              <Button 
                type="button" 
                variant="secondary" 
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              loading={isLoading}
              disabled={formData.topic_tags.length === 0}
            >
              {mode === 'create' ? 'Create Session' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}