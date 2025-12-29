(function(n){n.loader.impl(function(){return["ext.gadget.store.VueHelloWorld@6d058d29",function(r,a,u,d){n.config.get("wgCanonicalNamespace")==="Special"&&n.config.get("wgCanonicalSpecialPageName")==="Blankpage"&&n.config.get("wgTitle").endsWith("/HelloWorld")&&n.loader.using(["vue","@wikimedia/codex"]).then(t=>{const o=t("vue"),c=t("@wikimedia/codex"),i=o.reactive({count:0,increment(){this.count++}}),e=o.createMwApp({template:`
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
