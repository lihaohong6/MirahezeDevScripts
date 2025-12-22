(function(e){e.loader.impl(function(){return["ext.gadget.store.VueHelloWorld@348791e6",function(r,a,u,d){e.config.get("wgCanonicalNamespace")==="Special"&&e.config.get("wgCanonicalSpecialPageName")==="Blankpage"&&e.config.get("wgTitle").endsWith("/HelloWorld")&&e.loader.using(["vue","@wikimedia/codex"]).then(o=>{const n=o("vue"),c=o("@wikimedia/codex"),i=n.reactive({count:0,increment(){this.count++}}),t=n.createMwApp({template:`
            <component-a/>
            <component-b/>
            `});t.component("component-a",{template:`
            <div style="margin-bottom: 1rem">
              <cdx-button action="progressive" type="primary" @click="store.increment()">
                From A: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:i}),components:{CdxButton:c.CdxButton}}),t.component("component-b",{template:`
            <div>
              <cdx-button @click="store.increment()">
                From B: {{ store.count }}
              </cdx-button>
            </div>
            `,setup:()=>({store:i}),components:{CdxButton:c.CdxButton}}),t.mount("#content")})},{css:[]},{},{},null]})})(mediaWiki);
