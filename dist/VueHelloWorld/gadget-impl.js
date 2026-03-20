(function(e){e.loader.impl(function(){return["ext.gadget.store.VueHelloWorld@16de0ce9",function(r,a,u,d){e.config.get("wgCanonicalNamespace")==="Special"&&e.config.get("wgCanonicalSpecialPageName")==="Blankpage"&&e.config.get("wgTitle").endsWith("/HelloWorld")&&e.loader.using(["vue","@wikimedia/codex"]).then(t=>{const o=t("vue"),c=t("@wikimedia/codex"),i=o.reactive({count:0,increment(){this.count++}}),n=o.createMwApp({template:`
            <component-a/>
            <component-b/>
            `});n.component("component-a",{template:`
            <div style="margin-bottom: 1rem">
              <cdx-button action="progressive" type="primary" @click="store.increment()">
                From A: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:i}),components:{CdxButton:c.CdxButton}}),n.component("component-b",{template:`
            <div>
              <cdx-button @click="store.increment()">
                From B: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:i}),components:{CdxButton:c.CdxButton}}),n.mount("#content")})},{css:[]},{},{},null]})})(mediaWiki);
