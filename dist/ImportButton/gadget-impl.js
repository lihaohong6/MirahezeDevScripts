(function(t){t.loader.impl(function(){return["ext.gadget.store.ImportButton@51dc5025",function(c,d,p,u){[10,828].includes(t.config.get("wgNamespaceNumber"))&&t.config.get("wgUserId")!==null&&t.loader.using("@wikimedia/codex").then(l=>{const s=l("vue"),a=l("@wikimedia/codex");t.hook("wikipage.content").add(n=>{n&&n.find(".how-to-export").each((m,r)=>{const o=document.createElement("div");r.append(o),s.createMwApp({data:()=>({wikis:[],selectedWikiUrl:null,templateName:t.config.get("wgPageName")}),template:`
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
          `,methods:{openImportPage(){if(!this.selectedWikiUrl)return;const e=new URL(this.selectedWikiUrl+"/wiki/Special:Import");e.searchParams.set("source","interwiki"),e.searchParams.set("interwiki","dev"),e.searchParams.set("frompage",this.templateName),e.hash="mw-import-interwiki-form";const i=window.open(e.href,"_blank");i&&i.focus()},loadWikis(){new t.Api().get({action:"query",format:"json",meta:"globaluserinfo",formatversion:"2",guiprop:"groups|unattached|merged"}).then(e=>{this.wikis=e.query.globaluserinfo.merged.filter(i=>i.groups&&i.groups.includes("sysop")).map(i=>({label:new URL(i.url).hostname,value:i.url}))}).catch(e=>{t.notify("importButton: Failed to load wikis!",{type:"error"}),t.log.error("Failed to load wikis",e),this.wikis=[{label:"Error loading wikis",value:"",disabled:!0}]})},saveSelectedWiki(){const e=this.wikis.find(i=>i.value===this.selectedWikiUrl);e&&t.storage.set("template-installer-selected-wiki",JSON.stringify({label:e.label,value:e.value}))}},mounted(){const e=t.storage.get("template-installer-selected-wiki");if(e){const i=JSON.parse(e);this.wikis.push({label:i.label,value:i.value}),this.selectedWikiUrl=i.value}this.wikis.push({label:"Loading...",value:"",disabled:!0})}}).component("cdx-button",a.CdxButton).component("cdx-select",a.CdxSelect).mount(o)})})})},{css:[]},{},{},null]})})(mediaWiki);
