'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Badge } from '@/components/ui'
import { PlusIcon, PackageIcon, DollarSignIcon, EditIcon, EyeIcon } from 'lucide-react'

interface Product {
  product_id: string
  name: string
  description: string
  default_price: {
    id: string
    unit_amount: number
    currency: string
  } | null
  connected_account_id: string
  images: string[]
  created: number
}

export default function ExpertProductsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'usd'
  })

  useEffect(() => {
    loadUserAndProducts()
  }, [])

  const loadUserAndProducts = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      
      setUser(currentUser)
      
      // Get user's Stripe account ID (in production, this would be from database)
      const stripeAccountId = localStorage.getItem(`stripe_account_${currentUser.id}`)
      if (stripeAccountId) {
        await loadProducts(stripeAccountId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async (connectedAccountId: string) => {
    try {
      const response = await fetch(`/api/stripe/products?connected_account_id=${connectedAccountId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load products')
      }
      
      const { products } = await response.json()
      setProducts(products)
    } catch (err) {
      console.error('Error loading products:', err)
      setError(err instanceof Error ? err.message : 'Failed to load products')
    }
  }

  const createProduct = async () => {
    if (!user || !formData.name || !formData.price) return
    
    const stripeAccountId = localStorage.getItem(`stripe_account_${user.id}`)
    if (!stripeAccountId) {
      setError('Please connect your Stripe account first')
      return
    }
    
    setCreating(true)
    setError(null)
    
    try {
      const priceInCents = Math.round(parseFloat(formData.price) * 100)
      
      const response = await fetch('/api/stripe/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          priceInCents,
          currency: formData.currency,
          connectedAccountId: stripeAccountId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to create product')
      }

      console.log('✅ Product created successfully')
      
      // Reset form and refresh products
      setFormData({ name: '', description: '', price: '', currency: 'usd' })
      setShowCreateForm(false)
      await loadProducts(stripeAccountId)
      
    } catch (err) {
      console.error('Error creating product:', err)
      setError(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setCreating(false)
    }
  }

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className=\"min-h-screen bg-surface flex items-center justify-center\">
        <div className=\"text-center\">
          <div className=\"animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4\"></div>
          <p className=\"text-text-light\">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className=\"min-h-screen bg-surface\">
      <div className=\"max-w-6xl mx-auto px-4 py-8\">
        <div className=\"flex justify-between items-center mb-8\">
          <div>
            <h1 className=\"text-3xl font-bold text-text mb-2\">Products</h1>
            <p className=\"text-text-light\">
              Manage your products and pricing for the platform.
            </p>
          </div>
          
          <Button
            variant=\"primary\"
            onClick={() => setShowCreateForm(true)}
          >
            <PlusIcon className=\"w-4 h-4 mr-2\" />
            Create Product
          </Button>
        </div>

        {error && (
          <Card className=\"bg-error-bg border-error-text/20 mb-6\">
            <CardContent className=\"py-4\">
              <p className=\"text-error-text\">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Create Product Form */}
        {showCreateForm && (
          <Card className=\"mb-6\">
            <CardHeader>
              <CardTitle>Create New Product</CardTitle>
              <CardDescription>
                Add a new product to your catalog. Products are created at the platform level.
              </CardDescription>
            </CardHeader>
            <CardContent className=\"space-y-4\">
              <div className=\"grid md:grid-cols-2 gap-4\">
                <div>
                  <Input
                    label=\"Product Name\"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder=\"AI Consultation Session\"
                  />
                </div>
                
                <div className=\"flex gap-2\">
                  <div className=\"flex-1\">
                    <Input
                      label=\"Price\"
                      type=\"number\"
                      step=\"0.01\"
                      min=\"0\"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder=\"29.99\"
                    />
                  </div>
                  <div className=\"w-24\">
                    <label className=\"block text-sm font-medium text-text mb-1\">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className=\"w-full p-2 border border-border rounded-lg\"
                    >
                      <option value=\"usd\">USD</option>
                      <option value=\"eur\">EUR</option>
                      <option value=\"gbp\">GBP</option>
                      <option value=\"dkk\">DKK</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div>
                <label className=\"block text-sm font-medium text-text mb-1\">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder=\"Detailed description of your product or service...\"
                  className=\"w-full p-3 border border-border rounded-lg resize-none\"
                  rows={3}
                />
              </div>
              
              <div className=\"flex gap-3\">
                <Button
                  variant=\"primary\"
                  onClick={createProduct}
                  loading={creating}
                  disabled={!formData.name || !formData.price}
                >
                  Create Product
                </Button>
                <Button
                  variant=\"secondary\"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        {products.length > 0 ? (
          <div className=\"grid md:grid-cols-2 lg:grid-cols-3 gap-6\">
            {products.map((product) => (
              <Card key={product.product_id}>
                <CardHeader>
                  <CardTitle className=\"flex items-center gap-2\">
                    <PackageIcon className=\"w-5 h-5\" />
                    {product.name}
                  </CardTitle>
                  <CardDescription>
                    {product.description || 'No description provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent className=\"space-y-4\">
                  <div className=\"flex items-center justify-between\">
                    <div className=\"flex items-center gap-2\">
                      <DollarSignIcon className=\"w-4 h-4 text-success-text\" />
                      <span className=\"font-semibold text-lg\">
                        {product.default_price ? 
                          formatPrice(product.default_price.unit_amount, product.default_price.currency) : 
                          'No price set'
                        }
                      </span>
                    </div>
                    <Badge variant=\"neutral\">Active</Badge>
                  </div>
                  
                  <div className=\"text-sm text-text-light\">
                    <p>Created: {formatDate(product.created)}</p>
                    <p>Product ID: {product.product_id.substring(0, 12)}...</p>
                  </div>
                  
                  <div className=\"flex gap-2\">
                    <Button variant=\"secondary\" size=\"sm\" className=\"flex-1\">
                      <EditIcon className=\"w-4 h-4 mr-1\" />
                      Edit
                    </Button>
                    <Button 
                      variant=\"secondary\" 
                      size=\"sm\" 
                      className=\"flex-1\"
                      onClick={() => router.push(`/storefront?product=${product.product_id}`)}
                    >
                      <EyeIcon className=\"w-4 h-4 mr-1\" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className=\"text-center py-12\">
            <CardContent>
              <PackageIcon className=\"w-12 h-12 text-text-light mx-auto mb-4\" />
              <h3 className=\"text-lg font-semibold text-text mb-2\">No products yet</h3>
              <p className=\"text-text-light mb-4\">
                Create your first product to start selling on the platform.
              </p>
              <Button
                variant=\"primary\"
                onClick={() => setShowCreateForm(true)}
              >
                <PlusIcon className=\"w-4 h-4 mr-2\" />
                Create Your First Product
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className=\"mt-8 bg-blue-50 border-blue-200\">
          <CardContent className=\"py-4\">
            <div className=\"flex items-start gap-3\">
              <PackageIcon className=\"w-5 h-5 text-blue-600 mt-0.5\" />
              <div>
                <h4 className=\"font-medium text-blue-800 mb-1\">How products work</h4>
                <p className=\"text-sm text-blue-700\">
                  Products are created at the platform level and linked to your Stripe Connect account. 
                  When customers purchase your products, payments are processed as destination charges 
                  with automatic application fees. You'll receive the payment minus platform fees 
                  directly to your connected Stripe account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}