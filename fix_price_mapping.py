import re

# Read the file
with open('app/api/expert-sessions/route.ts', 'r') as f:
    content = f.read()

# First fix: Add price_amount mapping in GET method
content = re.sub(
    r'(\s+return {\s+\.\.\.session,)',
    r'\1\n        price_amount: session.price_cents, // Map price_cents to price_amount for API consistency',
    content
)

# Second fix: Add price_amount mapping in POST method return
content = re.sub(
    r'(session: newSession)',
    r'session: { ...newSession, price_amount: newSession.price_cents }',
    content
)

# Write the fixed content back
with open('app/api/expert-sessions/route.ts', 'w') as f:
    f.write(content)

print("Fixed price field mapping in expert-sessions API")
