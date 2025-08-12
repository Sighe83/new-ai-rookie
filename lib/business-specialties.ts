// Business-focused AI specialties for professionals across all industries
export const BUSINESS_SPECIALTIES = [
  // Business Strategy & Operations
  "AI Strategy & Planning",
  "Digital Transformation",
  "Process Automation",
  "Workflow Optimization",
  "Business Intelligence",
  "Decision Support Systems",
  
  // Marketing & Sales
  "Marketing Automation",
  "Customer Analytics",
  "Content Generation",
  "Sales Forecasting",
  "Lead Generation",
  "Social Media AI",
  
  // Finance & Accounting
  "Financial Analysis",
  "Risk Assessment",
  "Fraud Detection",
  "Investment Analysis",
  "Budget Planning",
  "Financial Reporting",
  
  // Human Resources
  "Recruitment Automation",
  "Employee Analytics",
  "Performance Management",
  "Training & Development",
  "Talent Acquisition",
  "Workforce Planning",
  
  // Operations & Supply Chain
  "Supply Chain Optimization",
  "Inventory Management",
  "Quality Control",
  "Predictive Maintenance",
  "Logistics Planning",
  "Operations Research",
  
  // Customer Service
  "Chatbot Development",
  "Customer Support Automation",
  "Sentiment Analysis",
  "Voice Recognition",
  "Customer Experience",
  "Help Desk Optimization",
  
  // Healthcare & Life Sciences
  "Medical Data Analysis",
  "Patient Care Optimization",
  "Clinical Decision Support",
  "Drug Discovery",
  "Medical Imaging",
  "Health Records Management",
  
  // Legal & Compliance
  "Contract Analysis",
  "Legal Research",
  "Compliance Monitoring",
  "Document Review",
  "Regulatory Analytics",
  "Risk Management",
  
  // Education & Training
  "Personalized Learning",
  "Educational Content Creation",
  "Student Assessment",
  "Learning Analytics",
  "Course Optimization",
  "Training Automation",
  
  // Real Estate & Construction
  "Property Valuation",
  "Market Analysis",
  "Building Automation",
  "Project Management",
  "Energy Optimization",
  "Safety Monitoring",
  
  // Manufacturing
  "Production Optimization",
  "Quality Assurance",
  "Equipment Monitoring",
  "Supply Planning",
  "Safety Systems",
  "Cost Analysis",
  
  // Retail & E-commerce
  "Recommendation Systems",
  "Pricing Optimization",
  "Inventory Forecasting",
  "Customer Behavior Analysis",
  "Product Search",
  "Demand Planning"
] as const

export type BusinessSpecialty = typeof BUSINESS_SPECIALTIES[number]

// Helper function to get specialty categories
export const getSpecialtyCategories = () => {
  return {
    "Business Strategy": ["AI Strategy & Planning", "Digital Transformation", "Process Automation", "Workflow Optimization", "Business Intelligence", "Decision Support Systems"],
    "Marketing & Sales": ["Marketing Automation", "Customer Analytics", "Content Generation", "Sales Forecasting", "Lead Generation", "Social Media AI"],
    "Finance": ["Financial Analysis", "Risk Assessment", "Fraud Detection", "Investment Analysis", "Budget Planning", "Financial Reporting"],
    "Human Resources": ["Recruitment Automation", "Employee Analytics", "Performance Management", "Training & Development", "Talent Acquisition", "Workforce Planning"],
    "Operations": ["Supply Chain Optimization", "Inventory Management", "Quality Control", "Predictive Maintenance", "Logistics Planning", "Operations Research"],
    "Customer Service": ["Chatbot Development", "Customer Support Automation", "Sentiment Analysis", "Voice Recognition", "Customer Experience", "Help Desk Optimization"],
    "Healthcare": ["Medical Data Analysis", "Patient Care Optimization", "Clinical Decision Support", "Drug Discovery", "Medical Imaging", "Health Records Management"],
    "Legal": ["Contract Analysis", "Legal Research", "Compliance Monitoring", "Document Review", "Regulatory Analytics", "Risk Management"],
    "Education": ["Personalized Learning", "Educational Content Creation", "Student Assessment", "Learning Analytics", "Course Optimization", "Training Automation"],
    "Real Estate": ["Property Valuation", "Market Analysis", "Building Automation", "Project Management", "Energy Optimization", "Safety Monitoring"],
    "Manufacturing": ["Production Optimization", "Quality Assurance", "Equipment Monitoring", "Supply Planning", "Safety Systems", "Cost Analysis"],
    "Retail": ["Recommendation Systems", "Pricing Optimization", "Inventory Forecasting", "Customer Behavior Analysis", "Product Search", "Demand Planning"]
  }
}