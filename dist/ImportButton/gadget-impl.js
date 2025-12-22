(function(i){i.loader.impl(function(){return["ext.gadget.store.ImportButton@2c0db354",function(c,d,p,u){[10,828].includes(i.config.get("wgNamespaceNumber"))&&i.config.get("wgUserId")!==null&&i.loader.using("@wikimedia/codex").then(l=>{const r=l("vue"),a=l("@wikimedia/codex");i.hook("wikipage.content").add(o=>{o&&o.find(".how-to-export").each((m,n)=>{const s=document.createElement("div");n.append(s),r.createMwApp({data:()=>({wikis:[],selectedWikiUrl:null,templateName:i.config.get("wgPageName")}),template:`
          <hr style="margin: 10px 0;" />
          <b>Pre-fill import parameters</b>
          <div style="display: flex; gap: 0.25em;">
          <cdx-select
          v-model:selected="selectedWikiUrl"
          :menu-items="wikis"
          default-label="Select wiki"
          @click="loadWikis"
          @update:selected="saveSelectedWiki"
          />
          <cdx-button
          action="progressive"
          :disabled="!selectedWikiUrl"
          @click="openImportPage"
          >Open</cdx-button>
          </div>
          <p>Clicking the "Open" button will open the import page on the selected wiki in a new tab. Please click "Import" on the import page to complete the installation.</p>
          `,methods:{openImportPage(){if(!this.selectedWikiUrl)return;const e=new URL(this.selectedWikiUrl+"/wiki/Special:Import");e.searchParams.set("source","interwiki"),e.searchParams.set("interwiki","dev"),e.searchParams.set("frompage",this.templateName),e.hash="mw-import-interwiki-form";const t=window.open(e.href,"_blank");t&&t.focus()},loadWikis(){new i.Api().get({action:"query",format:"json",meta:"globaluserinfo",formatversion:"2",guiprop:"groups|unattached|merged"}).then(e=>{this.wikis=e.query.globaluserinfo.merged.filter(t=>t.groups&&t.groups.includes("sysop")).map(t=>({label:new URL(t.url).hostname,value:t.url}))}).catch(e=>{i.notify("importButton: Failed to load wikis!",{type:"error"}),i.log.error("Failed to load wikis",e),this.wikis=[{label:"Error loading wikis",value:"",disabled:!0}]})},saveSelectedWiki(){const e=this.wikis.find(t=>t.value===this.selectedWikiUrl);e&&i.storage.set("template-installer-selected-wiki",JSON.stringify({label:e.label,value:e.value}))}},mounted(){const e=i.storage.get("template-installer-selected-wiki");if(e){const t=JSON.parse(e);this.wikis.push({label:t.label,value:t.value}),this.selectedWikiUrl=t.value}this.wikis.push({label:"Loading...",value:"",disabled:!0})}}).component("cdx-button",a.CdxButton).component("cdx-select",a.CdxSelect).mount(s)})})})},{css:[]},{},{},null]})})(mediaWiki);
