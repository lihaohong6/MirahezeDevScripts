// <nowiki>
// Hello World Boilerplate code used to test Vue.js and Codex
// Source:
// https://en.wikipedia.org/wiki/User:Plantaest/TestVue.js
if (
	mw.config.get('wgCanonicalNamespace') === 'Special'
    && mw.config.get('wgCanonicalSpecialPageName') === 'Blankpage'
    && mw.config.get('wgTitle').endsWith('/HelloWorld')
) {	
    mw.loader.using(['vue', '@wikimedia/codex']).then(function (require) {
        const Vue = require('vue');
        const Codex = require('@wikimedia/codex');

        const store = Vue.reactive({
            count: 0,
            increment() {
                this.count++;
            },
        });

        const App = Vue.createMwApp({
            template: `
            <component-a/>
            <component-b/>
            `,
        });

        App.component('component-a', {
            template: `
            <div style="margin-bottom: 1rem">
              <cdx-button action="progressive" type="primary" @click="store.increment()">
                From A: {{ store.count }}
              </cdx-button>
            </div>
            `,
            setup: () => ({ store }),
            components: {
                CdxButton: Codex.CdxButton,
            },
        });

        App.component('component-b', {
            template: `
            <div>
              <cdx-button @click="store.increment()">
                From B: {{ store.count }}
              </cdx-button>
            </div>
            `,
            setup: () => ({ store }),
            components: {
                CdxButton: Codex.CdxButton,
            },
        });

        App.mount('#content');
    });
}
// </nowiki>