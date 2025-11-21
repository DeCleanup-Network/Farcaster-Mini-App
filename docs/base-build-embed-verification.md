# Base Build Embed Metadata Verification Guide

This guide helps you verify that the Base Build embed metadata is correctly deployed and working.

## Step 1: Verify Deployment on Vercel

1. **Check Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com) and log in
   - Navigate to your project: `Farcaster-Mini-App` (or your project name)
   - Check the latest deployment status
   - Wait for the deployment to complete (usually 1-2 minutes)

2. **Verify Deployment URL**
   - Your deployment should be at: `https://farcaster-mini-app-umber.vercel.app/`
   - Or check your Vercel dashboard for the actual deployment URL

## Step 2: Verify Meta Tag in HTML

### Option A: Browser DevTools

1. **Open your deployed site** in a browser
2. **Right-click** → **Inspect** (or press `F12`)
3. Go to the **Elements** tab (Chrome) or **Inspector** tab (Firefox)
4. Find the `<head>` section
5. Look for the meta tag:
   ```html
   <meta name="fc:miniapp" content='{"version":"next","imageUrl":"...","button":{...}}' />
   ```

### Option B: View Page Source

1. **Open your deployed site** in a browser
2. **Right-click** → **View Page Source** (or press `Ctrl+U` / `Cmd+U`)
3. **Search** for `fc:miniapp` (press `Ctrl+F` / `Cmd+F`)
4. You should see the meta tag with the JSON content

### Option C: cURL Command

Run this command in your terminal:

```bash
curl -s https://farcaster-mini-app-umber.vercel.app/ | grep -o '<meta name="fc:miniapp"[^>]*>'
```

You should see output like:
```html
<meta name="fc:miniapp" content='{"version":"next","imageUrl":"https://beige-defiant-spoonbill-537.mypinata.cloud/ipfs/...","button":{...}}' />
```

### Option D: Online HTML Validator

1. Go to [validator.w3.org](https://validator.w3.org/)
2. Enter your deployment URL: `https://farcaster-mini-app-umber.vercel.app/`
3. Check for the `fc:miniapp` meta tag in the results

## Step 3: Verify JSON Structure

The meta tag content should be valid JSON. You can extract and validate it:

```bash
# Extract and pretty-print the JSON
curl -s https://farcaster-mini-app-umber.vercel.app/ | \
  grep -oP '(?<=content=.)[^"]*' | \
  head -1 | \
  sed "s/'/\"/g" | \
  python3 -m json.tool
```

Expected structure:
```json
{
  "version": "next",
  "imageUrl": "https://beige-defiant-spoonbill-537.mypinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru",
  "button": {
    "title": "Open DeCleanup",
    "action": {
      "type": "launch_frame",
      "url": "https://farcaster-mini-app-umber.vercel.app/",
      "name": "DeCleanup Rewards",
      "splashImageUrl": "https://beige-defiant-spoonbill-537.mypinata.cloud/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy",
      "splashBackgroundColor": "#000000"
    }
  }
}
```

## Step 4: Test in Base Build

1. **Log into Base Build**
   - Go to [base.org](https://base.org) and log in
   - Navigate to **Base Build** section

2. **Open Your Mini App**
   - Find "DeCleanup Rewards" in your mini apps list
   - Click on it to open the configuration

3. **Check Manifest Validation**
   - Base Build should now show the manifest as **valid**
   - The "Invalid manifest" error should be gone
   - You should see a green checkmark or success message

4. **Test Embeds & Previews**
   - Go to the **Embeds & Previews** section in Base Build
   - You should see a preview of how your app will appear when shared
   - The preview should show:
     - Your hero image (3:2 aspect ratio)
     - "Open DeCleanup" button
     - App name and description

5. **Verify HomeUrl**
   - Ensure the `homeUrl` in your manifest matches the deployment URL
   - Current homeUrl: `https://farcaster-mini-app-umber.vercel.app/`
   - This must match exactly (including trailing slash)

## Step 5: Troubleshooting

### If Meta Tag is Missing

1. **Check Vercel Build Logs**
   - Go to Vercel dashboard → Your project → Deployments
   - Click on the latest deployment
   - Check the build logs for any errors

2. **Verify next.config.ts**
   - Ensure `next.config.ts` doesn't have any issues
   - Check that the build completed successfully

3. **Clear Vercel Cache**
   - In Vercel dashboard, go to Settings → General
   - Click "Clear Build Cache"
   - Redeploy

### If Base Build Still Shows Invalid Manifest

1. **Verify homeUrl Matches**
   - Check `.well-known/farcaster.json`
   - Ensure `homeUrl` matches your deployment URL exactly
   - Update if needed and redeploy

2. **Check Image URLs**
   - Verify all image URLs in the embed metadata are accessible
   - Test each URL in a browser to ensure they load
   - Ensure images meet requirements:
     - `imageUrl`: 3:2 aspect ratio, max 10MB, max 1024 chars
     - `splashImageUrl`: 200x200px, max 32 chars (URL length)

3. **Validate JSON Structure**
   - Use a JSON validator to ensure the meta tag content is valid JSON
   - Check for any special characters that might break the JSON

4. **Wait for Propagation**
   - Sometimes changes take a few minutes to propagate
   - Wait 5-10 minutes and check again

## Expected Results

✅ **Success Indicators:**
- Meta tag appears in HTML head
- JSON structure is valid
- Base Build shows manifest as valid
- Embeds & Previews section shows preview correctly
- No "Invalid manifest" errors

❌ **Failure Indicators:**
- Meta tag missing from HTML
- Invalid JSON in meta tag
- Base Build still shows "Invalid manifest"
- Image URLs return 404 or don't load

## Next Steps After Verification

Once verified:
1. ✅ Share your mini app link - embeds will work correctly
2. ✅ Test sharing in Farcaster - preview should appear
3. ✅ Monitor Base Build for any future validation issues

