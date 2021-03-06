const Router = require('koa-router');
const fs = require('fs');
const path = require('path');
const LRU = require('lru-cache');
const { createBundleRenderer } = require('vue-server-renderer');

const { isProd } = require('../utils');

function createRenderer(bundle, options) {
  return createBundleRenderer(bundle, Object.assign(options), {
    cache: new LRU({
      max: 1000,
      maxAge: 1000 * 60 * 15
    }),
    runInNewContext: false
  });
}

module.exports = async (app) => {
  const router = new Router();

  let renderer;
  let readyPromise;

  const template = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf-8');

  if (isProd) {
    const bundle = require('../../dist/vue-ssr-server-bundle.json');
    const clientManifest = require('../../dist/vue-ssr-client-manifest.json');

    renderer = createRenderer(bundle, {
      template,
      clientManifest
    });
  } else {
    readyPromise = require('../../build/setup-dev-server')(app, (bundle, clientManifest) => {
      renderer = createRenderer(bundle, {
        template,
        clientManifest
      });
    });
  }

  async function render(ctx) {
    try {
      ctx.headers['Content-type'] = 'text/html';

      const context = {
        url: ctx.path,
        user: ctx.currentUser || {},
        cookies: ctx.request.headers['cookie']
      };

      const html = await renderer.renderToString(context);

      if (context.router.currentRoute.fullPath !== ctx.path) {
        return ctx.redirect(context.router.currentRoute.fullPath);
      }

      ctx.body = html;
    } catch (err) {
      if (err.code === 404) {
        ctx.redirect('/');
      } else if (err.message.indexOf(401) > -1) {
        ctx.redirect('/admin/login');
      } else {
        console.log('render error~~~~', err);
      }
    }
  }

  router.get('*', isProd ? render : async(ctx) => {
    await readyPromise.then(() => render(ctx));
  });

  app.use(router.routes()).use(router.allowedMethods());
};
