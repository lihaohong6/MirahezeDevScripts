(function(mw){mw.loader.impl(function(){return ["ext.gadget.store.ImportButton@8565c64b",function($,jQuery,require,module){[10,828].includes(mw.config.get("wgNamespaceNumber"))&&mw.config.get("wgUserId")!==null&&mw.loader.using("@wikimedia/codex").then(l=>{const r=l("vue"),a=l("@wikimedia/codex");mw.hook("wikipage.content").add(s=>{s&&s.find(".how-to-export").each((c,n)=>{const o=document.createElement("div");n.append(o),r.createMwApp({data:()=>({wikis:[],selectedWikiUrl:null,templateName:mw.config.get("wgPageName")}),template:`
          <hr />
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
          `,methods:{openImportPage(){if(!this.selectedWikiUrl)return;const e=new URL(this.selectedWikiUrl+"/wiki/Special:Import");e.searchParams.set("source","interwiki"),e.searchParams.set("interwiki","dev"),e.searchParams.set("frompage",this.templateName),e.hash="mw-import-interwiki-form";const t=window.open(e.href,"_blank");t&&t.focus()},loadWikis(){new mw.Api().get({action:"query",format:"json",meta:"globaluserinfo",formatversion:"2",guiprop:"groups|unattached|merged"}).then(t=>{this.wikis=t.query.globaluserinfo.merged.filter(i=>i.groups&&i.groups.includes("sysop")).map(i=>({label:new URL(i.url).hostname,value:i.url}))}).catch(t=>{mw.notify("importButton: Failed to load wikis!",{type:"error"}),mw.log.error("Failed to load wikis",t),this.wikis=[{label:"Error loading wikis",value:"",disabled:!0}]})},saveSelectedWiki(){const e=this.wikis.find(t=>t.value===this.selectedWikiUrl);e&&mw.storage.set("template-installer-selected-wiki",JSON.stringify({label:e.label,value:e.value}))}},mounted(){const e=mw.storage.get("template-installer-selected-wiki");if(e){const t=JSON.parse(e);this.wikis.push({label:t.label,value:t.value}),this.selectedWikiUrl=t.value}this.wikis.push({label:"Loading...",value:"",disabled:!0})}}).component("cdx-button",a.CdxButton).component("cdx-select",a.CdxSelect).mount(o)})})});},{"css":[]},{},{},null];});})(mediaWiki);