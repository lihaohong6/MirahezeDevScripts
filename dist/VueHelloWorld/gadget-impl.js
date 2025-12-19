(function(t){t.loader.impl(function(){return["ext.gadget.store.VueHelloWorld@7fff4360",function(r,a,u,d){t.config.get("wgCanonicalNamespace")==="Special"&&t.config.get("wgCanonicalSpecialPageName")==="Blankpage"&&t.config.get("wgTitle").endsWith("/HelloWorld")&&t.loader.using(["vue","@wikimedia/codex"]).then(o=>{const n=o("vue"),c=o("@wikimedia/codex"),i=n.reactive({count:0,increment(){this.count++}}),e=n.createMwApp({template:`
            <component-a/>
            <component-b/>
            `});e.component("component-a",{template:`
            <div style="margin-bottom: 1rem">
              <cdx-button action="progressive" type="primary" @click="store.increment()">
                From A: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:i}),components:{CdxButton:c.CdxButton}}),e.component("component-b",{template:`
            <div>
              <cdx-button @click="store.increment()">
                From B: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:i}),components:{CdxButton:c.CdxButton}}),e.mount("#content")})},{css:[]},{},{},null]})})(mediaWiki);
