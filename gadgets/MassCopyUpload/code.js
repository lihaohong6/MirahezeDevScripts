/* 
* Gadget-mass-copy-upload.js
* Author: [[User:CoolMikeHatsune22]]
* 
* This is a Javascript-based gadget that installs a special page (address set by 
* the variable SPECIAL_PAGE_TITLE, default page is located at 
* Special:BlankPage/MassCopyUploadImages) that may be used to mass transfer images
* between wikis by copy-uploading the files by URL. Reference:
* https://www.mediawiki.org/wiki/Manual:Configuring_file_uploads/en#Uploading_directly_from_a_URL_("Sideloading")
*/

/* <pre> */
( function ( mw ) {
  'use strict';
  
  // =================
  //   User configuration
  // =================
  
  // The tool will only make an AJAX request per interval as set by this variable
  // Hard minimum limit: 600ms
  const TIME_INTERVAL_PER_UPLOAD_IN_MILLISECONDS = (window.MassCopyUpload || {}).TIME_INTERVAL_PER_UPLOAD_IN_MILLISECONDS || 1000;
  
  // Limit number of simultaneous copy upload requests made during batch operation
  const MAX_NUMBER_OF_UPLOAD_REQUESTS = (window.MassCopyUpload || {}).MAX_NUMBER_OF_UPLOAD_REQUESTS || 4;
  
  // Number of files that may be uploaded per mass operation
  const MAX_FILE_UPLOADS_PER_BATCH_OPERATION = (window.MassCopyUpload || {}).MAX_FILE_UPLOADS_PER_BATCH_OPERATION || 500;
  
  // Special Page on which to run this tool
  const SPECIAL_PAGE_TITLE = (window.MassCopyUpload || {}).SPECIAL_PAGE_TITLE || 'Special:BlankPage/MassCopyUploadImages';
  
  // =================
  //   Messages
  // =================
  const messages = {
    // UI - Titles & Overview
    'ui--document-webpage-title': 'Mass Copy Upload Images - $1',
    'ui--document-title': 'Mass Copy Upload Images',
    'ui--overview-explanation': (
      'This is a tool used for transferring images from one wiki to another by copy-uploading the files through URL in batches. ' +
      'To use this tool, <code><nowiki>$</nowiki>wgAllowCopyUploads</code> must be set to true on LocalSettings.php, and the user right <code>upload_by_url</code> must be granted to the user. ' +
      'For more information, refer to the page [[mw:Manual:Configuring_file_uploads/en#Uploading_directly_from_a_URL_("sideloading")|Configuring file uploads]] on the official MediaWiki documentation.'
    ),
    'ui--overview-batch-size-limit-message': 'A maximum of $1 files may be uploaded per mass operation.',
    
    // Confirmation messages
    'ui--load-image-metadata-list-confirmation': 'This will load the image metadata for the listed files. Continue?',
    'ui--clear-image-metadata-list-confirmation': 'Are you sure you want to clear the list of image metadata currently listed on the page?',
    'ui--upload-images-confirmation': 'This will upload $1 file(s) to the wiki. Continue?',
    
    // UI - Form labels
    'ui--app-is-loading': 'Loading...',
    'ui--source-wiki-info-heading': 'Import images from the following wiki',
    'ui--source-wiki-url-form-label': 'Source Wiki URL',
    'ui--source-wiki-script-path-form-label': 'Source Wiki script path',
    'ui--license-info-heading': 'License',
    'ui--license-dropdown-label': 'Select a license',
    'ui--license-dropdown-plc-message': 'Select a license',
    'ui--license-dropdown-no-license': 'No license',
    'ui--file-list-heading': 'Import the following files',
    'ui--number-of-files-info-summary': '$1 file(s) to import',
    'ui--ignore-api-warnings-label': 'Ignore warnings from the MediaWiki API?',
    'ui--ignore-api-warnings-details': 'When this option is selected, the gadget will attempt to upload images regardless of warnings from the MediaWiki API (e.g. files with identical image contents but with different names, or files that exist on the target wiki with the same name as files to be imported). You should disable this option if you are using this tool for the first time.',
    'ui--import-page-contents-label': 'Import page contents?',
    'ui--import-page-contents-details': 'When this option is selected, the gadget will also copy the file description from the corresponding File: page on the source wiki. This description is only copied over if a File: page of the same name does not yet exist on the target wiki. Be sure to check that the target wiki supports the templates that may be carried over when enabling this option.',
    
    // UI - Buttons
    'ui--fetch-image-metadata-button': 'Fetch image metadata',
    'ui--upload-images-from-fetched-metadata': 'Upload images using fetched metadata',
    'ui--upload-images-from-user-urls': 'Upload images using supplied URLs',
    'ui--reupload-images': 'Re-upload images',

    // UI - Notifications
    'ui-notif--query-source-wiki': 'Making a query to $1...',
    'ui-notif--successfully-set-source-wiki': 'Image metadata will be fetched by calling $1',
    'ui-notif--successfully-fetched-image-metadata': 'Successfully fetched metadata',
    'ui-notif--successfully-uploaded-files': 'Finishing up the last uploads of the batch...',
    
    // Image metadata results
    'ui--image-metadata-heading': 'Image metadata information',
    'ui--image-metadata-file-number-col-header': 'No.',
    'ui--image-metadata-filename-col-header': 'File',
    'ui--image-metadata-filesize-col-header': 'Size',
    'ui--image-metadata-static-url-col-header': 'Static URL',
    'ui--image-metadata-upload-status-col-header': 'Upload Status',
    'ui--image-metadata-static-url-not-found-notice': 'Cannot find static URL',
    'ui--image-metadata-list-none-queued': 'There are currently no files in the queue to upload',
    'ui--image-metadata-filter-unsuccessful-uploads': 'Show failed uploads',
    'ui--image-metadata-show-all-uploads': 'Show all upload tasks',
    
    // Upload API status summary
    'ui--file-upload-status-message-success': 'Success',
    'ui--file-upload-status-message-error': 'Failed',
    'ui--file-upload-status-message-queued': 'Queued',
    'ui--file-upload-status-message-uploading': 'Uploading',
    'ui--file-upload-status-message-warning': 'File not uploaded - Got API Warning',
    
    // Error notifications
    'error-init--forbidden-user': 'Current user is forbidden from uploading via URL.',
    'error-init--forbidden-user-more-details': 'Make sure that your current wiki is set to allow file uploads by loading from URL, and that you have the user right <code>upload_by_url</code> granted by a wiki bureaucrat.',
    'error-init--unexpected': 'An unexpected error has occurred.',
    'error-resp--csp': 'Your network request to $1 is blocked due to Content Security Policy.',
    'error-resp--failed-to-fetch-metadata': 'Failed to fetch image metadata.',
    'error-resp--no-metadata-is-fetched': 'Fetch the image metadata first!',
    'error-resp--no-image-to-upload': 'There are no images available to upload. Images should include the File: namespace (e.g. File:Foo.png)',
    'warning--exceeded-max-batch-size-limit': 'You have entered $1 lines in the input box. Only $2 files will be uploaded when you click the \'Upload Files\' button.',
    
    // Detailed error messages on body
    'unexpected--upload-error': 'An unexpected error has occurred',
    'invalid--cannot-reach-source-wiki': 'Unable to reach the Action API at $1',
    'invalid--no-source-wiki-error-details': 'The source wiki URL must not be empty',
    'badreq--invalid-file-list-format': 'At least one file must be specified. Filenames must start with the File: namespace.',

    // Upload API response detailed messages
    'upload-response--exists': 'A file with the given name already exists.',
    'upload-response--exists__no-change': 'A file with the given name already exists and is exactly the same as the uploaded file.', 
    'upload-response--exists__duplicateversions': 'A file with the given name already exists and an old version of that file is exactly the same as the uploaded file.',
    'upload-response--page-exists': 'A page with the given name already exists.',
    'upload-response--was-deleted': 'A file with the given name used to exist but has been deleted.',
    'upload-response--duplicate': 'The uploaded file exists under a different (or the same) name. Uploading a duplicate may be undesirable.',
    'upload-response--duplicate-archive': 'The uploaded used to exist under a different (or the same) name but has been deleted. This may indicate that the file is inappropriate and should not be uploaded.',
    'upload-response--badfilename': 'Bad filename'
  };
  mw.messages.set(messages);
  
  // =================
  //   Gadget settings
  // =================
  // For logging
  const GADGET_NAME = 'MassCopyUpload';
  // For styling
  const GADGET_CONTAINER_ID = 'mass-copy-upload-container';
  // This is a hard cap placed by the MediaWiki API. You shouldn't change this in most cases.
  const NUMBER_OF_FILES_PER_API_QUERY = 50;
  
  let userInputsStore, 
  licensesStore, 
  errorMessagesStore, 
  imagesMetadataStore, 
  uploadTrackingStore;
  
  // =================
  //   State management
  // =================
  function loadInitialState(Vue) {
    userInputsStore = Vue.reactive({
      sourceWikiBasicDomain: '',
      sourceWikiScriptPath: '/w',
      filesToImport: [],
      usesUserSuppliedUrls: false,
      ignoreApiWarnings: false,
      importPageContents: false,
      inputsChanged: false,
      targetWikiApi() {
        return new mw.Api();
      },
      sourceWikiApiPath() {
        return this.sourceWikiBasicDomain.trim()+this.sourceWikiScriptPath.trim()+'/api.php';
      },
      sourceWikiApi() {
        return new mw.ForeignApi(this.sourceWikiApiPath(), { anonymous: true });
      },
      numberOfFilesToImport() {
        return this.filesToImport.length;
      },
      setFilesToImport(textAreaInput) {
        let arr = textAreaInput.trim().split(/\n+/)
          .map((item) => item.trim() )
          .filter((item) => (item !== '') )
          .filter((item) => item.match(/^[Ff]ile:/) );
        this.usesUserSuppliedUrls = arr.length > 0 && arr.some((item) => item.includes('|') );
        if (this.usesUserSuppliedUrls) {
          arr = arr.filter((item) => item.includes('|') );
        }
        this.filesToImport = arr;
      }
    });
    licensesStore = Vue.reactive({
      options: [],
      selected: null,
    });
    errorMessagesStore = Vue.reactive({
      initErrorCode: false,
      sourceWikiErrorMessage: '',
      sourceWikiLoadingMessage: ''
    });
    imagesMetadataStore = Vue.reactive({
      imagesMetadata: [],
      firstUploadFinished: false,
      filterUnsuccessful: false,
      staticUrls() {
        return this.imagesMetadata.filter(function (el) {
          return (el.staticUrl !== null && el.uploadStatusCss !== 'success');
        });
      },
      hasFailedTasks() {
      	return this.imagesMetadata.some(function (el) {
          return el.uploadStatusCss !== 'success';
        });
      }
    });
    uploadTrackingStore = Vue.reactive({
      uploadProcessId: null,
      uploadCounter: null,
      availableUploadRequestCount: MAX_NUMBER_OF_UPLOAD_REQUESTS,
    });
  }
  
  // =================
  //   UI
  // =================
  function loadApp({ Vue, Codex, wgSiteName }) {
    loadInitialState(Vue);
    
    const App = Vue.createMwApp({
      template: `
      <gadget-overview/>
      <div v-if="errorMessagesStore.initErrorCode === false">
        <cdx-progress-indicator show-label>{{ $i18n( 'ui--app-is-loading' ).text() }}</cdx-progress-indicator>
      </div>
      <div v-else-if="errorMessagesStore.initErrorCode === null">
        <source-wiki-inputs/>
        <target-wiki-license/>
        <file-list-input/>
        <action-buttons/>
        <file-list-query-results/>
      </div>
      <div v-else>
        <no-permissions-notice />
      </div>
      `,
      components: {
        CdxProgressIndicator: Codex.CdxProgressIndicator
      },
      setup: () => ({ errorMessagesStore }),
    });
    
    App.component('gadget-overview', {
      template: `
      <div style="margin-bottom: 20px;">
        <p v-i18n-html:ui--overview-explanation></p>
        <p>{{ $i18n( 'ui--overview-batch-size-limit-message', limit ).text() }}</p>
      </div>
      `,
      setup: () => ({ limit: MAX_FILE_UPLOADS_PER_BATCH_OPERATION }),
    });
    
    App.component('no-permissions-notice', {
      template: `
      <div class="mass-upload-error-message">{{ initErrorHeading }}</div>
      <div 
        class="mass-upload-error-more-details" 
        v-if="initErrorDetailsMessageName !== null"
        v-i18n-html="initErrorDetailsMessageName"
      ></div>
      `,
      setup: () => ({ errorMessagesStore }),
      computed: {
        initErrorHeading() {
          switch (this.errorMessagesStore.initErrorCode) {
            case null:
            case false:
              return null;
            case 0:
              return mw.message( 'error-init--forbidden-user' ).text();
            case -1:
              return mw.message( 'error-init--unexpected' ).text();
          }
        },
        initErrorDetailsMessageName() {
          switch (this.errorMessagesStore.initErrorCode) {
            case null:
            case false:
              return null;
            case 0:
              return 'error-init--forbidden-user-more-details';
            case -1:
              return null;
          }
        }
      }
    });
    
    App.component('source-wiki-inputs', {
      template: `
      <h2>{{ $i18n( 'ui--source-wiki-info-heading' ).text() }}</h2>
      <div class="form-group">
        <div class="form-group-label">{{ $i18n( 'ui--source-wiki-url-form-label' ).text() }}</div>
        <div class="form-group-inputs">
          <cdx-text-input 
            id="source-wiki-api-url-input" input-type="url"
            placeholder="https://en.wikipedia.org"
            v-model="userInputsStore.sourceWikiBasicDomain" 
            @change="setChangeFlag"
            @blur="onChangeSourceWiki"
          />
        </div>
      </div>
      <div class="form-group">
        <div class="form-group-label">{{ $i18n( 'ui--source-wiki-script-path-form-label' ).text() }}</div>
        <div class="form-group-inputs">
          <cdx-text-input 
            id="source-wiki-api-script-path-input" 
            placeholder="/w"
            v-model="userInputsStore.sourceWikiScriptPath" 
            @change="setChangeFlag"
            @blur="onChangeSourceWiki"
          />
        </div>
      </div>
      <div class="form-group">
        <div class="form-group-label"></div>
        <div class="source-wiki-notif">
          <div class="error">
            {{ errorMessagesStore.sourceWikiErrorMessage }}
          </div>
          <div>
            {{ errorMessagesStore.sourceWikiLoadingMessage }}
          </div>
        </div>
        <div id="mw-api-notif">
        </div>
      </div>
      `,
      components: {
        CdxTextInput: Codex.CdxTextInput,
      },
      setup: () => ({ userInputsStore, errorMessagesStore }),
      methods: {
        onChangeSourceWiki(event) {
          if (userInputsStore.inputsChanged) { checkSourceWikiApi(); }
          userInputsStore.inputsChanged = false;
        },
        setChangeFlag() {
          userInputsStore.inputsChanged = true;
        }
      }
    });
    
    App.component('target-wiki-license', {
      template: `
      <h2>{{ $i18n( 'ui--license-info-heading' ).text() }}</h2>
      <div class="form-group">
        <div class="form-group-label">{{ $i18n( 'ui--license-dropdown-label' ).text() }}</div>
        <div class="form-group-inputs">
          <cdx-select 
            v-model:selected="licensesStore.selected"
            :menu-items="licensesStore.options"
            :default-label="dropdownDefaultLabel"
            style="width:100%"
          />
        </div>
      </div>
      `,
      components: {
        CdxSelect: Codex.CdxSelect,
      },
      computed: {
        dropdownDefaultLabel() {
          return mw.message( 'ui--license-dropdown-plc-message' ).text();
        }
      },
      setup: () => ({ userInputsStore, licensesStore, errorMessagesStore }),
    });
    
    App.component('file-list-input', {
      template: `
      <div id='file-list-input-container'>
        <h2>{{ $i18n( 'ui--file-list-heading' ).text() }}</h2>
        <cdx-text-area 
          @change="setChangeFlag"
          @blur="onUpdateFileListInput"
          id="file-list-input" rows="10"
          placeholder="File:Foo.png\nFile:Bar.png\nFile:Baz.png\n..." rows="10"
        />
        <div id='file-list-info-summary'>{{ $i18n( 'ui--number-of-files-info-summary', userInputsStore.numberOfFilesToImport() ).text() }}</div>
        <div id='file-list-exceeded-limit' class='error' v-if="exceededFileLimit">
          {{ $i18n( 'warning--exceeded-max-batch-size-limit', userInputsStore.numberOfFilesToImport(), limit ).text() }}
        </div>
      </div>
      `,
      components: {
        CdxTextArea: Codex.CdxTextArea,
      },
      setup: () => ({ userInputsStore, errorMessagesStore, limit: MAX_FILE_UPLOADS_PER_BATCH_OPERATION }),
      computed: {
        exceededFileLimit() {
          return (this.userInputsStore.numberOfFilesToImport() > this.limit);
        },
      },
      methods: {
        onUpdateFileListInput: function (event) {
          if (userInputsStore.inputsChanged) { userInputsStore.setFilesToImport(event.target.value); }
          userInputsStore.inputsChanged = false;
        },
        setChangeFlag() {
          userInputsStore.inputsChanged = true;
        }
      }
    });
    
    App.component('action-buttons', {
      template: `
      <div>
        <div class="action-buttons" v-if="!userInputsStore.usesUserSuppliedUrls">
          <cdx-button 
            action="progressive" type="primary" 
            @click="onClickedFetchMetadata"
            v-bind:disabled="uploadInProgress"
          >
            {{ $i18n( 'ui--fetch-image-metadata-button' ).text() }}
          </cdx-button>
          <cdx-button 
            action="progressive" type="primary" 
            @click="onClickedUploadFilesFromMetadata"
            v-bind:disabled="uploadInProgress"
          >
            {{ $i18n( 'ui--upload-images-from-fetched-metadata' ).text() }}
          </cdx-button>
          <cdx-button 
            action="progressive" type="primary" 
            v-if="(imagesMetadataStore.firstUploadFinished && !userInputsStore.inputsChanged && imagesMetadataStore.hasFailedTasks())"
            @click="onClickedReuploadFilesFromMetadata"
            v-bind:disabled="uploadInProgress"
          >
            {{ $i18n( 'ui--reupload-images' ).text() }}
          </cdx-button>
        </div>
        <div class="action-buttons" v-else>
          <cdx-button 
            action="progressive" type="primary" 
            @click="onClickedUploadFilesFromUserUrls"
            v-bind:disabled="uploadInProgress"
          >
            {{ $i18n( 'ui--upload-images-from-user-urls' ).text() }}
          </cdx-button>
          <cdx-button 
            action="progressive" type="primary" 
            v-if="(imagesMetadataStore.firstUploadFinished && !userInputsStore.inputsChanged && imagesMetadataStore.hasFailedTasks())"
            @click="onClickedReuploadFilesFromUserUrls"
            v-bind:disabled="uploadInProgress"
          >
            {{ $i18n( 'ui--reupload-images' ).text() }}
          </cdx-button>
        </div>
        <div class="action-checkbox">
          <cdx-checkbox v-model="userInputsStore.ignoreApiWarnings">
            {{ $i18n( 'ui--ignore-api-warnings-label' ).text() }}
            <template #description>
              {{ $i18n( 'ui--ignore-api-warnings-details' ).text() }}
            </template>
          </cdx-checkbox>
        </div>
        <div class="action-checkbox" v-if="!userInputsStore.usesUserSuppliedUrls">
          <cdx-checkbox v-model="userInputsStore.importPageContents">
            {{ $i18n( 'ui--import-page-contents-label' ).text() }}
            <template #description>
              {{ $i18n( 'ui--import-page-contents-details' ).text() }}
            </template>
          </cdx-checkbox>
        </div>
      </div>
      `,
      components: {
        CdxButton: Codex.CdxButton,
        CdxCheckbox: Codex.CdxCheckbox,
      },
      setup: () => ({ imagesMetadataStore, userInputsStore }),
      computed: {
      	uploadInProgress() {
      	  return !!uploadTrackingStore.uploadProcessId;
      	}
      },
      methods: {
        onClickedFetchMetadata,
        onClickedUploadFilesFromMetadata () { 
          beforeUploadFiles({ fromMetadata: true, isReupload: false }); 
        },
        onClickedUploadFilesFromUserUrls () { 
          beforeUploadFiles({ fromMetadata: false, isReupload: false }); 
        },
        onClickedReuploadFilesFromMetadata () { 
          beforeUploadFiles({ fromMetadata: true, isReupload: true }); 
        },
        onClickedReuploadFilesFromUserUrls () { 
          beforeUploadFiles({ fromMetadata: false, isReupload: true }); 
        },
      }
    });
    
    App.component('file-list-query-results', {
      template: `
      <div id='file-list-queried-container'>
        <h2>{{ $i18n( 'ui--image-metadata-heading' ).text() }}</h2>
        <cdx-progress-bar aria-label="Indeterminate progress bar" v-if="uploadInProgress" />
        <div class="action-buttons" v-if="imagesMetadataStore.firstUploadFinished">
          <cdx-button 
            action="progressive" type="primary"
            v-if="(!imagesMetadataStore.filterUnsuccessful && imagesMetadataStore.hasFailedTasks())"
            @click="toggleFilterUnsuccessful"
          >
            {{ $i18n( 'ui--image-metadata-filter-unsuccessful-uploads' ).text() }}
          </cdx-button>
          <cdx-button 
            action="progressive" type="primary" 
            v-if="imagesMetadataStore.filterUnsuccessful"
            @click="toggleFilterUnsuccessful"
          >
            {{ $i18n( 'ui--image-metadata-show-all-uploads' ).text() }}
          </cdx-button>
        </div>
        <cdx-table
          id="file-list-queried-table"
          :hideCaption="true"
          :columns="columns"
          :data="data"
          :use-row-headers="true"
        >
          <template #item-renderedFilename="{ row }">
            <span v-if="row.descriptionUrl === null">
              {{ row.title }}
            </span>
            <a v-bind:href="row.descriptionUrl" rel="nofollow noindex" target="_blank" v-else>
              {{ row.title }}
            </a>
          </template>
      
          <template #item-staticUrl="{ item }">
            <span v-if="item === null">
              {{ $i18n( 'ui--image-metadata-static-url-not-found-notice' ).text() }}
            </span>
            <a v-bind:href="item" rel="nofollow noindex" target="_blank" v-else>
              {{ item }}
            </a>
          </template>
      
          <template #item-renderedUploadStatus="{ row }">
            <div :class="['upload-status-code', row.uploadStatusCss]">
              {{ row.uploadStatusText }}
            </div>
            <div class="upload-details" v-if="!!row.uploadApiResponseDetails">
              {{ row.uploadApiResponseDetails }}
            </div>
          </template>
        </cdx-table>
        <div v-if="imagesMetadataStore.imagesMetadata.length === 0" class="file-list-query-info">
          {{ $i18n( 'ui--image-metadata-list-none-queued' ).text() }}
        </div>
      </div>
      `,
      setup: () => ({ 
      	userInputsStore, errorMessagesStore, imagesMetadataStore, formatBytes
      }),
      components: {
        CdxButton: Codex.CdxButton,
        CdxTable: Codex.CdxTable,
        CdxProgressBar: Codex.CdxProgressBar
      },
      computed: {
      	uploadInProgress() {
      	  return !!uploadTrackingStore.uploadProcessId;
      	},
        columns () {
          return [
            { 
              id: 'no', 
              label: mw.message('ui--image-metadata-file-number-col-header').text(), 
              minWidth: '40px'
            },
            { 
              id: 'renderedFilename', 
              label: mw.message('ui--image-metadata-filename-col-header').text(), 
              minWidth: '220px' 
            },
            { 
              id: 'filesize', 
              label: mw.message('ui--image-metadata-filesize-col-header').text(), 
              minWidth: '100px'
            },
            { 
              id: 'staticUrl', 
              label: mw.message('ui--image-metadata-static-url-col-header').text(), 
              minWidth: '220px'
            },
            { 
              id: 'renderedUploadStatus', 
              label: mw.message('ui--image-metadata-upload-status-col-header').text(), 
              minWidth: '150px'
            }
          ];
        },
        data () {
          return (
          	imagesMetadataStore.imagesMetadata
          	  .filter(function (item) {
          	  	return imagesMetadataStore.filterUnsuccessful ? item.uploadStatusCss !== 'success' : true;
              }).map(function (item, idx) {
                return {
                  no: idx+1,
                  descriptionUrl: item.descriptionUrl,
                  title: item.title,
                  filesize: item.size === null ? '-' : formatBytes(item.size, 2),
                  staticUrl: item.staticUrl,
                  uploadStatusCss: item.uploadStatusCss,
                  uploadStatusText: item.uploadStatusText,
                  uploadApiResponseDetails: item.uploadApiResponseDetails
                };
              })
          );
        }
      },
      methods: {
      	toggleFilterUnsuccessful () {
      	  imagesMetadataStore.filterUnsuccessful = !imagesMetadataStore.filterUnsuccessful;
      	}
      }
    });
    
    document.title = mw.msg('ui--document-webpage-title', wgSiteName);
    document.getElementById('firstHeading').innerText = mw.msg('ui--document-title');
    document.addEventListener("securitypolicyviolation", onDetectCspViolation);
    
    if (!document.getElementById(GADGET_CONTAINER_ID)) {
      const container = document.createElement("div");
      container.id = GADGET_CONTAINER_ID;
      document.getElementById('mw-content-text').innerHTML = '';
      document.getElementById('mw-content-text').appendChild(container);
    }
    App.mount('#'+GADGET_CONTAINER_ID);
    
    // Lazy loading
    fetchLicenses();
    checkIfTargetWikiAllowsUploadSideloading()
      .then(() => { errorMessagesStore.initErrorCode = null; })
      .catch((code) => { errorMessagesStore.initErrorCode = code; });
  }
  
  function onClickedFetchMetadata() {
  	if (userInputsStore.filesToImport.length === 0) {
      mw.notify(mw.message( 'badreq--invalid-file-list-format' ).text());
      return; 
    }
  	if (!window.confirm( mw.message( 
  	  imagesMetadataStore.imagesMetadata.length === 0 ? 
  	  'ui--load-image-metadata-list-confirmation' : 
  	  'ui--clear-image-metadata-list-confirmation'
  	).text() )) {
  	  return;
  	}
    checkSourceWikiApi(true)
    .then(function (isValidWikiPath) {
      if (!isValidWikiPath) { 
        return; 
      }
      fetchImageMetadata();
    });
  }

  function beforeUploadFiles({ fromMetadata = false, isReupload = false }) {
    const n = fromMetadata ? 
      imagesMetadataStore.staticUrls().length : 
      userInputsStore.numberOfFilesToImport();
    if (n === 0) {
      mw.notify(mw.message( 
        (fromMetadata && !isReupload) ? 
        'error-resp--no-metadata-is-fetched' :
        'error-resp--no-image-to-upload'
      ).text());
      return;
    }
    if (window.confirm(mw.message( 'ui--upload-images-confirmation', n).text())) {
      if (!fromMetadata && !isReupload) { loadUserUrls(); }
      uploadFiles();
    }
  }
  
  // =================
  //   Fetching logic
  // =================
  function fetchImageMetadata() {
    if (userInputsStore.usesUserSuppliedUrls) {
      console.error(GADGET_NAME, 'fetchImageMetadata should not be called when userInputsStore.usesUserSuppliedUrls == true');
      return;
    }
    const batches = [];
    for (let i = 0; i < Math.ceil(userInputsStore.filesToImport.length / NUMBER_OF_FILES_PER_API_QUERY); i++) {
      batches.push(userInputsStore.filesToImport.slice( 
        i*NUMBER_OF_FILES_PER_API_QUERY, (i+1)*NUMBER_OF_FILES_PER_API_QUERY 
      ));
    }
    const sourceWikiApi = userInputsStore.sourceWikiApi();
    const promises = batches.map(function (batch, batchIndex) {
      return new Promise(function (resolve, reject) {
      	// Because the user does not necessarily need to make up their mind 
      	// on immporting page contents before clicking "Fetch metadata", the 
      	// query should always get the latest page revision
        sourceWikiApi.get({
          action: 'query', 
          format: 'json',
          prop: 'imageinfo|revisions', 
          titles: batch.join('|'),
          iiprop: 'url|size|mediatype',
          rvprop: 'content',
          rvslots: '*'
        })
          .done(function (res) {
            const processed = Object.values(res.query.pages).map(function (v, itemIndex) {
              const title = v.title;
              if (v.missing !== undefined) {
                return {
                  index: batchIndex * NUMBER_OF_FILES_PER_API_QUERY + itemIndex,
                  pageid: null,
                  title: title.replace(/^[Ff]ile:/, ''),
                  exists: false,
                  descriptionUrl: null,
                  staticUrl: null,
                  size: null,
                  pageContents: null,
                  uploadStatusCss: 'error',
                  uploadStatusText: mw.message( 'ui--file-upload-status-message-error' ).text(),
                  uploadApiResponseDetails: null,
                };
              }
              const imageInfo = (v.imageinfo || [{}])[0];
              return {
                index: batchIndex * NUMBER_OF_FILES_PER_API_QUERY + itemIndex,
                pageid: v.pageid,
                title: title.replace(/^[Ff]ile:/, ''),
                exists: true,
                descriptionUrl: imageInfo.descriptionurl || null,
                staticUrl: imageInfo.url || null,
                size: imageInfo.size || null,
                pageContents: (
                  (v.revisions || []).length === 0 ? null :
                  ((v.revisions[0].slots || {}).main || {})['*'] || null
                ),
                uploadStatusCss: 'pending',
                uploadStatusText: mw.message( 'ui--file-upload-status-message-queued' ).text(),
                uploadApiResponseDetails: null,
              };
            });
            resolve(processed);
          })
          .fail(reject);
      });
    });
    Promise.allSettled(promises)
      .then(function (arrResults) {
        const listData = [];
        arrResults.forEach(function (data) {
          data.value.forEach(function (item) {
            listData.push(item);
          });
        });
        imagesMetadataStore.imagesMetadata = listData;
        imagesMetadataStore.firstUploadFinished = false;
        mw.notify( mw.message( 'ui-notif--successfully-fetched-image-metadata' ).text(), { type: 'success' } );
      })
      .catch(function (err) {
        console.error(GADGET_NAME, err);
        mw.notify( mw.message( 'error-resp--failed-to-fetch-metadata' ).text(), { type: 'error' });
      });
  }
  
  function loadUserUrls() {
    if (!userInputsStore.usesUserSuppliedUrls) {
      console.error(GADGET_NAME, 'loadUserUrls should not be called when userInputsStore.usesUserSuppliedUrls == false');
      return;
    }
    const res = [];
    for (let i = 0; i < userInputsStore.filesToImport.length; i++) {
      const fileToImport = userInputsStore.filesToImport[i];
      const rx = /^([Ff]ile\s*:\s*.+?)\s*\|\s*(https?:\/\/.+)$/.exec(fileToImport);
      if (rx === null) { continue; }
      const [_, filename, staticUrl] = rx;
      res.push({
        index: i,
        pageid: null,
        title: filename.replace(/^[Ff]ile:/, ''),
        exists: true,
        descriptionUrl: null,
        staticUrl: staticUrl,
        size: null,
        uploadStatusCss: 'pending',
        uploadStatusText: mw.message( 'ui--file-upload-status-message-queued' ).text(),
        uploadApiResponseDetails: null,
      });
    }
    imagesMetadataStore.imagesMetadata = res;
    imagesMetadataStore.firstUploadFinished = false;
  }
  
  function uploadFiles() {
    if (!!uploadTrackingStore.uploadProcessId) {
      console.error(GADGET_NAME, 'An upload is already in progress.');
      return;
    }
    uploadTrackingStore.uploadCounter = 0;
    // Don't overload the server, only make one request per set interval
    uploadTrackingStore.uploadProcessId = setInterval(function () {
      if (uploadTrackingStore.availableUploadRequestCount <= 0) {
        console.log(GADGET_NAME, 'Maximum number of simultaneous upload requests exceeded. Pausing upload request.');
        return;
      }
      let item = imagesMetadataStore.imagesMetadata[uploadTrackingStore.uploadCounter++];
      // Can't upload if the file has no static URL
      // No need to re-upload successful uplaods
      while (item !== undefined && (!item.staticUrl || item.uploadStatusCss === 'success')) {
      	item = imagesMetadataStore.imagesMetadata[uploadTrackingStore.uploadCounter++];
      }
      // Reached end of list, cleanup scheduled processes
      if (item === undefined) {
        if (!!uploadTrackingStore.uploadProcessId) {
          imagesMetadataStore.firstUploadFinished = true;
          imagesMetadataStore.filterUnsuccessful = false;
          clearInterval(uploadTrackingStore.uploadProcessId);
          uploadTrackingStore.uploadProcessId = null;
          mw.notify( mw.message( 'ui-notif--successfully-uploaded-files' ).text(), { type: 'success' } );
        }
        return;
      }
      item.uploadStatusCss = 'uploading';
      item.uploadStatusText = mw.message( 'ui--file-upload-status-message-uploading' ).text();
      item.uploadApiResponseDetails = null;
      uploadTrackingStore.availableUploadRequestCount--;
      userInputsStore.targetWikiApi().postWithEditToken({
        action: 'upload',
        format: 'json',
        filename: item.title,
        url: item.staticUrl,
        text: (
          userInputsStore.importPageContents ? (item.pageContents || undefined) :
          (licensesStore.selected || '') === '' ? undefined : (
            '== {{safesubst:MediaWiki:License-header}} ==\n{{'+licensesStore.selected+'}}'
          )
        ),
        ignorewarnings: userInputsStore.ignoreApiWarnings ? 1 : undefined
      })
      .done(handleUploadResponseFromApi(imagesMetadataStore, item.index))
      .fail(handleErrorUploadResponseFromApi(imagesMetadataStore, item.index))
      .always(function () {
        uploadTrackingStore.availableUploadRequestCount++;
      });
    }, Math.max(TIME_INTERVAL_PER_UPLOAD_IN_MILLISECONDS, 600));
  }
  
  function handleUploadResponseFromApi(imagesMetadataStore, index) {
    return function (res) {
      const apiUploadStatusSummary = res.upload.result;
      let uploadStatusText;
      let uploadStatusCss;
      
      switch (apiUploadStatusSummary) {
        case 'Success':
          uploadStatusText = mw.message( 'ui--file-upload-status-message-success' ).text();
          uploadStatusCss = 'success';
          break;
        case 'Warning':
          uploadStatusText = mw.message( 'ui--file-upload-status-message-warning' ).text();
          uploadStatusCss = 'warning';
          const warningMessages = translateMwUploadWarnings(res.upload.warnings);
          imagesMetadataStore.imagesMetadata[index].uploadApiResponseDetails = warningMessages.join(', ');
          break;
        case 'Failed':
        default:
          uploadStatusText = mw.message( 'ui--file-upload-status-message-error' ).text();
          uploadStatusCss = 'error';
          const errorMessage = (res.error || {}).info || mw.message( 'unexpected--upload-error' ).text();
          imagesMetadataStore.imagesMetadata[index].uploadApiResponseDetails = errorMessage;
      }
      imagesMetadataStore.imagesMetadata[index].uploadStatusCss = uploadStatusCss;
      imagesMetadataStore.imagesMetadata[index].uploadStatusText = uploadStatusText;
    };
  }
  
  function handleErrorUploadResponseFromApi(imagesMetadataStore, index) {
    return function (errorCode, errorObject, xhr) {
      const errorMessage = (errorObject.error || {}).info || mw.message( 'unexpected--upload-error' ).text();
      imagesMetadataStore.imagesMetadata[index].uploadStatusCss = 'error';
      imagesMetadataStore.imagesMetadata[index].uploadStatusText = mw.message( 'ui--file-upload-status-message-error' ).text();
      imagesMetadataStore.imagesMetadata[index].uploadApiResponseDetails = errorMessage;
    };
  }
  
  function checkIfTargetWikiAllowsUploadSideloading() {
    return new Promise(function (resolve, reject) {
      userInputsStore.targetWikiApi().getUserInfo()
        .done(function (res) {
          const userRights = res.rights;
          if (userRights.indexOf('upload_by_url') < 0) {
            reject(0);
          } else {
            resolve(true);
          }
        })
        .fail(function (err) {
          reject(-1);
        });
    });
  }
  
  function checkSourceWikiApi(showNotifs) {
    return new Promise(function (resolve, reject) {
      if (userInputsStore.sourceWikiBasicDomain === '') {
        errorMessagesStore.sourceWikiErrorMessage = mw.message('invalid--no-source-wiki-error-details').text();
        resolve(false);
        if (showNotifs) {
          mw.notify(
            mw.message( 'invalid--no-source-wiki-error-details', userInputsStore.sourceWikiApiPath() ).text(), 
            { type: 'error' }
          );
        }
        return;
      }
      errorMessagesStore.sourceWikiLoadingMessage = mw.message('ui-notif--query-source-wiki', userInputsStore.sourceWikiApiPath()).text();
      errorMessagesStore.sourceWikiErrorMessage = '';
      userInputsStore.sourceWikiApi().getUserInfo()
        .done(function () {
          errorMessagesStore.sourceWikiLoadingMessage = mw.message('ui-notif--successfully-set-source-wiki', userInputsStore.sourceWikiApiPath()).text();
          errorMessagesStore.sourceWikiErrorMessage = '';
          resolve(true);
        })
        .fail(function (err, xhr) {
          console.error(GADGET_NAME, 'Failed to assert Foreign MediaWiki API');
          console.error(GADGET_NAME, err, xhr);
          errorMessagesStore.sourceWikiLoadingMessage = '';
          errorMessagesStore.sourceWikiErrorMessage = mw.message('invalid--cannot-reach-source-wiki', userInputsStore.sourceWikiApiPath()).text();
          resolve(false);
          if (showNotifs) {
            mw.notify(
              mw.message( 'invalid--cannot-reach-source-wiki', userInputsStore.sourceWikiApiPath() ).text(),
              { type: 'error' }
            );
          }
        });
    });
  }
  
  function onDetectCspViolation() {
    mw.notify(mw.message('error-resp--csp', userInputsStore.sourceWikiApiPath()).text(), { type: 'error' });
    errorMessagesStore.sourceWikiErrorMessage = mw.message('invalid--cannot-reach-source-wiki', userInputsStore.sourceWikiApiPath()).text();
  }
  
  function fetchLicenses() {
    let options;
    $.get(mw.util.getUrl('MediaWiki:Licenses', { action: 'raw' }))
      .done(function (wikitext) {
        options = parseWikiLicenses(wikitext, 1);
      })
      .fail(function (err) {
        console.error(GADGET_NAME, "Failed to fetch license information");
        console.error(GADGET_NAME, err);
        options = [];
      })
      .always(function () {
        options.unshift({ label: mw.message( 'ui--license-dropdown-no-license' ).text(), data: null });
        licensesStore.options = options;
    });
  }
  
  // =================
  //   Utilities
  // =================
  function formatBytes(bytes, decimals) {
    if (!+bytes) { return '0 B'; }
    const k = 1024;
    const dm = (decimals || -1) < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return '' + parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  function parseOneLicenseItem(s, level) {
    s = s.replace(new RegExp("^\\*{" + level + "}\\s*"), '');
    const tm = s.match(/^(.*)\s*\|\s*(.*?)$/);
    if (tm === null) {
      return { label: s, value: s };
    } else {
      return { label: tm[2], value: tm[1] };
    }
  }
  
  function parseWikiLicenses(s, level) {
    if (level > 5) { return []; }	// Contigency: stop recursion if hit 5 sub-levels
    let rx = new RegExp("(?<=^|\\n)[^]+?(?=\\n\\*{" + level + "}(?!\\*)|$)", "g");
    let ms = Array.from(s.matchAll(rx));
    rx = new RegExp("^(\\*{" + level + "}(?!\\*)[\\r\\t ]*.*)[\\r\\t ]*(?:\\n\\s*([^]*)\\s*|)$");
    const res = [];
    for (let i = 0; i < ms.length; i++) {
      let mt = ms[i][0].trim().match(rx);
      let head = parseOneLicenseItem(mt[1], level), 
      inner = mt[2] || '';
      if (inner === '') {
        res.push(head);
        continue;
      }
      head.disabled = true;
      res.push(head);
      inner = parseWikiLicenses(inner, level+1);
      for (let j = 0; j < inner.length; j++) {
        res.push(inner[j]);
      }
    }
    return res;
  }
  
  function translateMwUploadWarnings(apiWarnings) {
    const warningMessages = [];
    if (apiWarnings.exists !== undefined) {
      if ((apiWarnings.exists || {})['no-change'] !== undefined) {
        warningMessages.push(mw.message('upload-response--exists__no-change').text());
      } else if ((apiWarnings.exists || {})['duplicateversions'] !== undefined) {
        warningMessages.push(mw.message('upload-response--exists__duplicateversions').text());
      } else {
        warningMessages.push(mw.message('upload-response--exists').text());
      }
    }
    ['page-exists', 'was-deleted', 'duplicate', 'duplicate-archive', 'badfilename'].forEach(function (k) {
      if (apiWarnings[k] !== undefined) {
        warningMessages.push(mw.message('upload-response--'+k).text());
      }
    });
    return warningMessages;
  }
  
  // =================
  //   Run
  // =================
  const mwConfig = mw.config.get([
    'wgPageName',
    'wgSiteName',
    'wgAction'
  ]);
  if (mwConfig.wgAction !== 'view') { return; }
  if (mwConfig.wgPageName !== SPECIAL_PAGE_TITLE) { return; }
  mw.loader.using(['vue', '@wikimedia/codex']).then(function (require) {
    const Vue = require('vue');
    const Codex = require('@wikimedia/codex');
    loadApp({ 
      Vue, Codex, wgSiteName: mwConfig.wgSiteName
    });
    const cssText = `#mass-copy-upload-container .source-wiki-notif{font-size:smaller}#mass-copy-upload-container .mass-upload-error-message{font-weight:bold;font-size:larger;margin-top:50px;margin-bottom:10px;color:red}#mass-copy-upload-container .action-buttons{text-align:center;vertical-align:middle;margin-top:20px}#mass-copy-upload-container .action-checkbox .cdx-label__description,#mass-copy-upload-container .action-checkbox .cdx-label__label{text-align:left}#mass-copy-upload-container .action-checkbox .cdx-label__description{font-size:smaller}#mass-copy-upload-container .action-checkbox .cdx-checkbox{margin-top:15px}#mass-copy-upload-container .form-group{display:flex;flex-direction:row;gap:20px;padding-bottom:10px;justify-content:flex-start;align-items:center}#mass-copy-upload-container .form-group-label{width:200px}#mass-copy-upload-container .form-group-inputs{flex-grow:2}#mass-copy-upload-container .form-group-inputs input{width:100%}@media (max-width:500px){#mass-copy-upload-container .form-group{flex-direction:column;align-items:flex-start;gap:5px}#mass-copy-upload-container .form-group-label{width:100%}#mass-copy-upload-container .form-group-inputs{width:100%}}#mass-copy-upload-container #file-list-input-container{margin-bottom:40px}#mass-copy-upload-container #file-list-info-summary,#mass-copy-upload-container #file-list-exceeded-limit{text-align:right}#mass-copy-upload-container #ignore-mw-warning-input{margin-left:10px}#mass-copy-upload-container #ignore-mw-warning-input > input{margin-right:5px}#mass-copy-upload-container #file-list-queried-table,#mass-copy-upload-container #file-list-queried-table thead,#mass-copy-upload-container #file-list-queried-table tbody,#mass-copy-upload-container #file-list-queried-table tr{width:100%}#mass-copy-upload-container #file-list-queried-table td *{word-break:break-word}#mass-copy-upload-container .upload-status-code{text-align:center;font-size:0.9rem !important}#mass-copy-upload-container .upload-status-code.pending{background-color:#c9f9f5;color:#000000}#mass-copy-upload-container .upload-status-code.success{background-color:#0eda1b;color:#ffffff}#mass-copy-upload-container .upload-status-code.warning{background-color:#a58012;color:white}#mass-copy-upload-container .upload-status-code.error{background-color:#d70808;color:white}#mass-copy-upload-container .upload-status-code.uploading{background-color:#7ce1d8;color:#000000}#mass-copy-upload-container .upload-details{font-size:0.7rem !important;text-align:center;margin-top:3px}#mass-copy-upload-container .file-list-query-info{font-weight:bold;text-align:center}#mass-copy-upload-container #file-list-exceeded-limit{font-size:small}`;
    mw.util.addCSS(cssText);
  });
  
})( mediaWiki );
/* </pre> */