# GitHub Actions Setup Guide

This repository includes automated CI/CD pipelines for both your Next.js application and Supabase database migrations.

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository:

### Navigate to Repository Settings
1. Go to your GitHub repository
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Required Secrets

#### Supabase Access Token
- **Name**: `SUPABASE_ACCESS_TOKEN`
- **Value**: Your personal Supabase access token
- **How to get**: Go to [Supabase Dashboard](https://supabase.com/dashboard/account/tokens) → Generate new token

#### Database Passwords
- **Name**: `STAGING_DB_PASSWORD`  
- **Value**: Your staging database password
- **How to get**: [new-ai-rookie-dev project](https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk) → Settings → Database → Connection string

- **Name**: `PRODUCTION_DB_PASSWORD`
- **Value**: Your production database password
- **How to get**: [new-ai-rookie project](https://supabase.com/dashboard/project/nowzrnuxrfsbmkszlves) → Settings → Database → Connection string

#### Project IDs (Pre-configured)
- **Staging**: `ogohsocipjwhohoiiilk` (new-ai-rookie-dev)
- **Production**: `nowzrnuxrfsbmkszlves` (new-ai-rookie)

## How the Pipeline Works

### Branch Strategy
- **Feature branches** → Create preview branches for testing
- **`develop` branch** → Auto-deploy to staging environment
- **`main` branch** → Auto-deploy to production environment

### Pipeline Steps

#### 1. Code Quality Checks (All branches)
- Runs `npm run lint`
- Runs `npm run build`
- Tests database migrations locally

#### 2. Staging Deployment (`develop` branch)
- Deploys database migrations to staging
- Updates staging environment
- Safe environment for testing

#### 3. Production Deployment (`main` branch)  
- Deploys database migrations to production
- Updates production environment
- Only runs after all tests pass

#### 4. Preview Branches (Pull Requests)
- Creates isolated Supabase branch for testing
- Each PR gets its own database instance
- Perfect for reviewing database changes

## Setup Checklist

- [ ] Add all required GitHub secrets
- [ ] Create staging Supabase project (if not exists)
- [ ] Create production Supabase project (if not exists)
- [ ] Test the pipeline by creating a PR
- [ ] Update app deployment steps in workflow (Vercel, Railway, etc.)

## Testing the Setup

1. **Create a test branch**:
   ```bash
   git checkout -b test-pipeline
   ```

2. **Make a small change** (like adding a comment to any file)

3. **Create a pull request** to `develop` branch

4. **Check the Actions tab** in GitHub to see the pipeline running

5. **Merge to develop** to test staging deployment

6. **Merge to main** to test production deployment

## Troubleshooting

### Common Issues

**Missing secrets**: Pipeline fails with authentication errors
- ✅ Double-check all GitHub secrets are set correctly

**Migration failures**: Database migrations fail to apply
- ✅ Test migrations locally with `supabase db reset`
- ✅ Check migration file syntax

**Permission errors**: Supabase CLI can't access projects
- ✅ Verify `SUPABASE_ACCESS_TOKEN` has correct permissions
- ✅ Check project IDs are correct

### Getting Help

- Check the **Actions** tab for detailed error logs
- Test locally with `supabase start` and `supabase db reset`
- Verify secrets match your Supabase dashboard settings

## Next Steps

1. **Customize app deployment**: Update the "Deploy application" steps for your hosting platform
2. **Add tests**: Create database tests in `supabase/tests/` directory  
3. **Monitor**: Watch the Actions tab for deployment status
4. **Scale**: Add more environments or deployment targets as needed