# Putting the site online

This is a one-time setup. When it's done, publishing a post is: save the file, commit, and push. Cloudflare rebuilds the site within a minute or two.

How the pieces connect:

```
your computer --push--> GitHub --builds--> Cloudflare --serves--> yourdomain.com
                                                ^
                     Namecheap sends visitors here (nameservers)
```

## What you need

- [Git](https://git-scm.com/downloads), or [GitHub Desktop](https://desktop.github.com) if you'd rather use buttons than commands
- A free [GitHub](https://github.com/signup) account
- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account
- Your Namecheap login

## 1. Put the project on GitHub

1. On GitHub, create a new repository (it can be private), for example `post-ops`. Leave it empty: don't add a README.
2. In the project folder, run:

```
git init
git add .
git commit -m "First version"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/post-ops.git
git push -u origin main
```

## 2. Move your domain's DNS to Cloudflare

Cloudflare can only attach a domain to your site if it manages that domain's DNS. The domain stays registered (and billed) at Namecheap. Only the nameservers change.

1. In Cloudflare, choose **Add a domain** (it may say "Add a site"), enter your domain, and pick the **Free** plan.
2. Cloudflare shows two nameservers, for example `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`. Keep that tab open.
3. In Namecheap, go to **Domain List**, then click **Manage** next to the domain.
4. Under **Nameservers**, change the dropdown to **Custom DNS** and enter the two Cloudflare nameservers. Click the check mark to save.
5. Back in Cloudflare, click **Check nameservers**. It usually turns **Active** within an hour. Namecheap says it can take up to 24 to 48 hours.

Do this for each domain you want to use. Because these domains have been pointing at nothing, nothing breaks while the change takes effect.

## 3. Connect GitHub to Cloudflare

1. In Cloudflare, open **Workers & Pages**, then **Create application**.
2. Choose **GitHub**, sign in to GitHub if asked, and select your `post-ops` repository.
3. Set:
   - **Build command:** `npm run build`
   - **Deploy command:** leave the default, `npx wrangler deploy`
4. Click **Save and Deploy**. Once it finishes, the site is live at a temporary `something.workers.dev` address. Open it to check that it works.

The deploy settings come from `wrangler.jsonc` in the project: they tell Cloudflare to serve the `dist` folder and use `404.html` for missing pages.

## 4. Attach your domain

This step needs the domain to show **Active** from step 2.

1. In **Workers & Pages**, open the `post-ops` Worker.
2. Go to **Settings**, then **Domains & Routes**, then **Add**, then **Custom Domain**.
3. Enter your domain (for example `yourdomain.com`) and click **Add Custom Domain**.

Cloudflare creates the DNS record and the HTTPS certificate on its own. It can take a few minutes before the domain loads.

**www:** `www.yourdomain.com` is a separate hostname. The simplest option is to add it as a second Custom Domain on the same Worker. The cleaner option is to redirect it to the main domain with a Cloudflare **Redirect Rule**.

**Your other domains:** you can add them as more Custom Domains, or redirect them to the main one the same way.

## 5. Final touch

In `site.config.json`, set `url` to your real address (for example `https://yourdomain.com`) and push. The RSS feed and link previews use this address.

## Publishing from now on

```
git add .
git commit -m "Post: kitchen tablet"
git push
```

Drafts (`draft: true`) are left out of the live site, so you can push unfinished posts safely.
