# Dependabot Setup Guide

## ✅ Status: Already Configured!

Dependabot is **already set up** and configured in this repository. The configuration file is located at `.github/dependabot.yml`.

## What is Dependabot?

Dependabot is GitHub's automated dependency update tool that:
- ✅ Scans your dependencies for security vulnerabilities
- ✅ Creates pull requests to update dependencies
- ✅ Groups updates to reduce PR noise
- ✅ Runs on a schedule (weekly, in this case)

## Current Configuration

Your Dependabot is configured to:

### 1. **npm Dependencies** (Production & Development)
- **Schedule**: Weekly on Mondays at 9:00 AM
- **Updates**: Minor and patch versions
- **Grouping**: 
  - Production dependencies grouped together
  - Development dependencies grouped together
- **PR Limit**: Maximum 10 open PRs at once
- **Labels**: `dependencies`, `automated`

### 2. **GitHub Actions**
- **Schedule**: Weekly on Mondays at 9:00 AM
- **PR Limit**: Maximum 5 open PRs at once
- **Labels**: `github-actions`, `automated`

## How It Works

1. **Dependabot scans** your `package.json` and `package-lock.json` weekly
2. **Checks for updates** to your dependencies
3. **Creates PRs** automatically for:
   - Security updates (critical priority)
   - Minor and patch version updates
4. **Groups updates** to reduce PR noise (e.g., all production deps in one PR)
5. **You review and merge** the PRs when ready

## Viewing Dependabot Activity

### On GitHub:
1. Go to your repository
2. Click **"Security"** tab
3. Click **"Dependabot"** in the sidebar
4. View:
   - Open pull requests
   - Security alerts
   - Update history

### Via GitHub CLI:
```bash
gh pr list --label "dependencies"
```

## Manual Dependabot Commands

You can manually trigger Dependabot checks (if you have GitHub Actions enabled):

```bash
# Check for updates manually (via GitHub UI)
# Go to: Settings → Security → Dependabot → Dependabot alerts
```

## Customization

If you need to customize Dependabot behavior, edit `.github/dependabot.yml`:

### Ignore Specific Packages:
```yaml
ignore:
  - dependency-name: "package-name"
    update-types: ["version-update:semver-major"]
```

### Change Schedule:
```yaml
schedule:
  interval: "daily"  # or "weekly", "monthly"
  day: "monday"
  time: "09:00"
```

### Disable Grouping:
Remove the `groups` section to get individual PRs for each dependency.

## Best Practices

1. ✅ **Review PRs regularly** - Don't let them pile up
2. ✅ **Test updates** - Run tests before merging
3. ✅ **Monitor security alerts** - Critical security updates should be merged quickly
4. ✅ **Use grouping** - Reduces PR noise (already configured)
5. ✅ **Set PR limits** - Prevents too many open PRs (already configured)

## Troubleshooting

### Dependabot not creating PRs?
- Check if Dependabot is enabled in repository settings
- Verify `.github/dependabot.yml` exists and is valid YAML
- Check GitHub Actions are enabled (if using manual triggers)

### Too many PRs?
- Reduce `open-pull-requests-limit` in config
- Enable grouping (already enabled)
- Ignore specific packages if needed

### PRs failing tests?
- Review the PR to see what changed
- Run tests locally with the updated versions
- Update your code if there are breaking changes

## Security Alerts

Dependabot also creates **security alerts** for vulnerable dependencies:
- View in: **Security** tab → **Dependabot alerts**
- Critical alerts should be addressed immediately
- Dependabot will create PRs to fix security issues automatically

## Next Steps

1. ✅ **Already done**: Configuration file created
2. ⚠️ **Verify**: Check GitHub repository settings that Dependabot is enabled
3. ⚠️ **Monitor**: Watch for Dependabot PRs starting next Monday
4. ⚠️ **Review**: Set up notifications for Dependabot PRs

---

**Configuration File**: `.github/dependabot.yml`  
**Status**: ✅ Configured and ready  
**Next Check**: Next Monday at 9:00 AM

