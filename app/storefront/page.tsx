'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui'
import { ShoppingCartIcon, PackageIcon, DollarSignIcon, UserIcon, CheckCircleIcon } from 'lucide-react'

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

export default function StorefrontPage() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const highlightProductId = searchParams.get('product')

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/stripe/products')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load products')
      }
      
      const { products } = await response.json()
      setProducts(products)
    } catch (err) {
      console.error('Error loading products:', err)
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const purchaseProduct = async (product: Product) => {
    if (!product.default_price) {
      setError('Product has no price set')
      return
    }
    
    setPurchasing(product.product_id)
    setError(null)
    
    try {
      // Calculate application fee (10% platform fee as example)
      const applicationFeeAmount = Math.round(product.default_price.unit_amount * 0.10)
      
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_id: product.default_price.id,
          product_id: product.product_id,
          connected_account_id: product.connected_account_id,
          quantity: 1,
          application_fee_amount: applicationFeeAmount,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/storefront`
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to create checkout')
      }

      const { checkout_url } = await response.json()
      console.log('✅ Redirecting to Stripe Checkout:', checkout_url)
      
      // Redirect to Stripe Checkout
      window.location.href = checkout_url
      
    } catch (err) {
      console.error('Error creating checkout:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
    } finally {
      setPurchasing(null)
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

  const getPlatformFee = (amount: number) => {
    return Math.round(amount * 0.10) // 10% platform fee
  }

  if (loading) {
    return (
      <div className=\"min-h-screen bg-surface flex items-center justify-center\">
        <div className=\"text-center\">
          <div className=\"animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4\"></div>
          <p className=\"text-text-light\">Loading storefront...</p>
        </div>
      </div>
    )
  }

  return (
    <div className=\"min-h-screen bg-surface\">
      <div className=\"max-w-7xl mx-auto px-4 py-8\">
        {/* Header */}
        <div className=\"text-center mb-12\">
          <h1 className=\"text-4xl font-bold text-text mb-4\">AI Learning Platform Store</h1>
          <p className=\"text-lg text-text-light max-w-2xl mx-auto\">
            Discover and purchase AI learning products from expert instructors. 
            All transactions are processed securely through Stripe Connect.
          </p>
        </div>

        {error && (
          <Card className=\"bg-error-bg border-error-text/20 mb-6 max-w-2xl mx-auto\">
            <CardContent className=\"py-4\">
              <p className=\"text-error-text text-center\">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        {products.length > 0 ? (
          <div className=\"grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6\">
            {products.map((product) => (
              <Card 
                key={product.product_id} 
                className={`${
                  highlightProductId === product.product_id 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : ''
                } transition-all hover:shadow-lg`}
              >
                <CardHeader>
                  <div className=\"flex justify-between items-start\">
                    <div>
                      <CardTitle className=\"flex items-center gap-2\">
                        <PackageIcon className=\"w-5 h-5\" />
                        <span className=\"line-clamp-2\">{product.name}</span>
                      </CardTitle>
                      {highlightProductId === product.product_id && (
                        <Badge variant=\"primary\" className=\"mt-1\">
                          Featured
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className=\"line-clamp-3\">
                    {product.description || 'No description provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent className=\"space-y-4\">
                  {/* Pricing */}
                  <div className=\"space-y-2\">
                    {product.default_price ? (
                      <>
                        <div className=\"flex items-center gap-2\">
                          <DollarSignIcon className=\"w-5 h-5 text-success-text\" />
                          <span className=\"text-2xl font-bold text-text\">
                            {formatPrice(product.default_price.unit_amount, product.default_price.currency)}
                          </span>
                        </div>
                        <p className=\"text-xs text-text-light\">
                          Platform fee: {formatPrice(getPlatformFee(product.default_price.unit_amount), product.default_price.currency)} 
                          (included)
                        </p>
                      </>
                    ) : (
                      <p className=\"text-text-light\">Price not set</p>
                    )}
                  </div>

                  {/* Seller Info */}
                  <div className=\"flex items-center gap-2 text-sm text-text-light\">
                    <UserIcon className=\"w-4 h-4\" />
                    <span>Expert Seller</span>
                    <Badge variant=\"success\" size=\"sm\">
                      <CheckCircleIcon className=\"w-3 h-3 mr-1\" />
                      Verified
                    </Badge>
                  </div>

                  {/* Product Details */}
                  <div className=\"text-xs text-text-light space-y-1\">
                    <p>Listed: {formatDate(product.created)}</p>
                    <p>ID: {product.product_id.substring(0, 12)}...</p>
                  </div>

                  {/* Purchase Button */}
                  <Button
                    variant=\"primary\"
                    onClick={() => purchaseProduct(product)}
                    loading={purchasing === product.product_id}
                    disabled={!product.default_price || purchasing !== null}
                    className=\"w-full\"
                  >
                    <ShoppingCartIcon className=\"w-4 h-4 mr-2\" />
                    {purchasing === product.product_id ? 'Processing...' : 'Buy Now'}
                  </Button>

                  {/* Security Badge */}
                  <div className=\"flex items-center justify-center gap-1 text-xs text-text-light\">
                    <CheckCircleIcon className=\"w-3 h-3 text-success-text\" />
                    <span>Secure checkout with Stripe</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className=\"text-center py-16 max-w-2xl mx-auto\">
            <CardContent>
              <PackageIcon className=\"w-16 h-16 text-text-light mx-auto mb-6\" />
              <h3 className=\"text-2xl font-semibold text-text mb-4\">No products available</h3>
              <p className=\"text-text-light mb-6\">
                There are currently no products in the store. Check back later for new AI learning products.
              </p>
              <p className=\"text-sm text-text-light\">
                Are you an expert? <a href=\"/expert/products\" className=\"text-primary hover:underline\">Create your products here</a>
              </p>
            </CardContent>
          </Card>
        )}

        {/* How it Works */}
        <Card className=\"mt-16 max-w-4xl mx-auto bg-blue-50 border-blue-200\">
          <CardHeader>
            <CardTitle className=\"text-center text-blue-800\">How Our Store Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className=\"grid md:grid-cols-3 gap-6 text-center\">
              <div>
                <div className=\"w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3\">
                  <PackageIcon className=\"w-6 h-6 text-blue-600\" />
                </div>
                <h4 className=\"font-semibold text-blue-800 mb-2\">Browse Products</h4>
                <p className=\"text-sm text-blue-700\">
                  Discover AI learning products created by verified expert instructors.
                </p>
              </div>
              
              <div>
                <div className=\"w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3\">
                  <ShoppingCartIcon className=\"w-6 h-6 text-blue-600\" />
                </div>
                <h4 className=\"font-semibold text-blue-800 mb-2\">Secure Purchase</h4>
                <p className=\"text-sm text-blue-700\">
                  Buy safely with Stripe's secure checkout. Payments go directly to experts.
                </p>
              </div>
              
              <div>
                <div className=\"w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3\">
                  <CheckCircleIcon className=\"w-6 h-6 text-blue-600\" />
                </div>
                <h4 className=\"font-semibold text-blue-800 mb-2\">Instant Access</h4>
                <p className=\"text-sm text-blue-700\">
                  Get immediate access to your purchased products and start learning.
                </p>
              </div>
            </div>
            
            <div className=\"mt-6 p-4 bg-blue-100 rounded-lg\">
              <p className=\"text-sm text-blue-800 text-center\">
                <strong>🔒 Powered by Stripe Connect:</strong> All transactions are processed securely. 
                Experts receive payments directly with automatic platform fee deduction.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}