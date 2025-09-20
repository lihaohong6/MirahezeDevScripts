(function(mw){mw.loader.impl(function(){return ["ext.gadget.store.VueHelloWorld@714f6d50",function($,jQuery,require,module){mw.config.get("wgCanonicalNamespace")==="Special"&&mw.config.get("wgCanonicalSpecialPageName")==="Blankpage"&&mw.config.get("wgTitle").endsWith("/HelloWorld")&&mw.loader.using(["vue","@wikimedia/codex"]).then(function(e){const o=e("vue"),n=e("@wikimedia/codex"),c=o.reactive({count:0,increment(){this.count++}}),t=o.createMwApp({template:`
            <component-a/>
            <component-b/>
            `});t.component("component-a",{template:`
            <div style="margin-bottom: 1rem">
              <cdx-button action="progressive" type="primary" @click="store.increment()">
                From A: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:c}),components:{CdxButton:n.CdxButton}}),t.component("component-b",{template:`
            <div>
              <cdx-button @click="store.increment()">
                From B: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:c}),components:{CdxButton:n.CdxButton}}),t.mount("#content")});},{"css":[]},{},{},null];});})(mediaWiki);