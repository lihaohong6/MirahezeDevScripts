/**
* AjaxBatchRedirect
* (based off of AjaxBatchDelete by Ozank Cx, //dev.fandom.com/AjaxBatchDelete)
* @description Extends AjaxRedirect with a modal that facilitates batch redirect.
* @author MonkeysHK
*/
/* jshint
esversion: 5, esnext: false, forin: true, immed: true, indent: 4,
latedef: true, newcap: true, noarg: true, undef: true, unused: true,
browser: true, jquery: true, onevar: true, eqeqeq: true, multistr: true,
maxerr: 999999, forin: false, -W082, -W084
*/
/* global mediaWiki, importArticle */
(function ($, mw) {
  var config = mw.config.get([
    "wgCanonicalNamespace",
    "wgCanonicalSpecialPageName",
    "wgPageName",
    "wgUserGroups",
    "wgRevisionId",
    "wgIsRedirect"
  ]),
  groupsWithDeletePerm = [
    "bureaucrat",
    "sysop",
    "global-admin"
  ],
  colorProgress = "rgb(20, 220, 23)",
  colorError = "rgb(220, 20, 60)",
  colorWarning = "rgb(100, 149, 237)",
  colorInfo = "black",
  api, i18n, myModal, processFlag;
  var $form,
      $progress,
      $pagesFrom,
      $pagesTo,
      $errorOutput;
  
  if (window.AjaxBatchRedirectLoaded) {
    return;
  }
  
  window.AjaxBatchRedirectLoaded = true;
  
  function notifyError(messagekey) {
    console.log(i18n.msg(messagekey).plain());
    mw.notify(i18n.msg(messagekey).plain(), {
      type: "error"
    });
  }
  
  function modalConsoleLog(messagekey, color, pagename, pagename2) {
    $errorOutput.append(
      $('<div>')
        .css('color', color)
        .text(i18n.msg(messagekey, pagename, pagename2).escape())
    );
  }
  
  function makeSimpleRedirect(fromPage, toPage) {
    return new Promise(function (resolve) {
      api.postWithEditToken({
        action: "edit",
        watchlist: "nochange",
        title: fromPage,
        minor: true,
        bot: true,
        text: "#REDIRECT [[" + toPage.charAt(0).toUpperCase() + toPage.slice(1) + "]]"
      }).done(function (d) {
        if (d.error)
          console.warn(d.error);
        resolve({
          error: (!d.error ? false : "redirectfail")
        });
      }).fail(function (err) {
        console.warn(err);
        resolve({
          error: "redirectfail"
        });
      });
    });
  }
  
  function makeDeleteRedirect(fromPage, toPage) {
    return new Promise(function (resolve) {
      api.postWithEditToken({
        action: "delete",
        watchlist: "nochange",
        title: fromPage,
        reason: i18n.msg("deleteReason").plain()
      }).done(function (d) {
        if (d.error) {
          console.warn(d.error);
          resolve({
            error: "deleteFail"
          });
          return;
        }
        resolve(makeSimpleRedirect(fromPage, toPage)); // here, make a redirect
      }).fail(function (err) {
        console.warn(err);
        resolve({
          error: "deleteFail"
        });
      });
    });
  }
  
  function makePageInfoQuery(pageList) {
    // pageList: array of <page_name>
    return new Promise(function (resolve) {
      api.get({
        action: "query",
        titles: pageList.flat().join("|"),
        prop: "info"
      }).done(function (d) {
        if (d.error)
          console.warn(d.error);
        resolve(d.error ? false : d.query.pages);
      }).fail(function (err) {
        console.warn(err);
        resolve(false);
      });
    });
  }
  
  function burstBuffer5x(pageList, actionFn, i, promisesHead, delay) {
    return new Promise(function (resolve) {
      var segment = pageList.slice(i, i + 5);
      promisesHead = promisesHead.concat(segment.map(function (v) {
        return actionFn(v[0], v[1]);
      }));
      if (i + 5 >= pageList.length)
        resolve(promisesHead);
      else {
        $progress.empty().append(
          $('<div>')
            .css('color', colorProgress)
            .text(
              i18n.msg("inCooldown", promisesHead.length, pageList.length).escape()
            )
        );
        setTimeout(function () {
          burstBuffer5x(pageList, actionFn, i + 5, promisesHead, delay).then(function (promisesHead) {
            resolve(promisesHead);
          });
        }, delay);
      }
    });
  }
  
  function runDeleteRedirectList(deleteRedirectList, failureList) {
    return new Promise(function (resolve) {
      burstBuffer5x(deleteRedirectList, makeDeleteRedirect, 0, [], 10000).then(function (promisesHead) {
        Promise.allSettled(promisesHead).then(function (values) {
          for (var i in values) {
            if (values[i].reason || values[i].value.error === "redirectfail") {
              modalConsoleLog("consoleRedirectFail", colorError, deleteRedirectList[i][0], deleteRedirectList[i][1]);
              failureList.push(deleteRedirectList[i]);
              if (values[i].reason)
                console.warn(values[i].reason);
            } else if (values[i].value.error === "deleteFail") {
              modalConsoleLog("consoleDeleteFail", colorError, deleteRedirectList[i][0], deleteRedirectList[i][1]);
              failureList.push(deleteRedirectList[i]);
            }
          }
          resolve(true);
        });
      });
    });
  }
  
  function runSimpleRedirectList(simpleRedirectList, failureList) {
    return new Promise(function (resolve) {
      burstBuffer5x(simpleRedirectList, makeSimpleRedirect, 0, [], 5000).then(function (promisesHead) {
        Promise.allSettled(promisesHead).then(function (values) {
          for (var i in values) {
            if (values[i].reason || values[i].value.error === "redirectfail") {
              modalConsoleLog("consoleRedirectFail", colorError, simpleRedirectList[i][0], simpleRedirectList[i][1]);
              failureList.push(simpleRedirectList[i]);
              if (values[i].reason)
                console.warn(values[i].reason);
            }
          }
          resolve(true);
        });
      });
    });
  }
  
  function redirectPages(pageList) {
    // pageList: array of [<from>, <to>]
    makePageInfoQuery(pageList).then(function (queryResults) {
      if (!queryResults) {
        notifyError("queryError");
        return;
      }
      var pageinfo = {},
          simpleRedirectList = [],
          deleteRedirectList = [],
          failureList = [],
          tasksawait = 1,
          i;
      var finished = function () {
        if (--tasksawait === 0) {
          var successCount = simpleRedirectList.length + deleteRedirectList.length - failureList.length;
          $errorOutput.append(
            $('<div>')
              .css('color', colorInfo)
              .text(
                i18n.msg("finished", successCount).escape()
              )
          );
          $pagesFrom.val(failureList.map(function (v) {
            return v[0];
          }).join("\n"));
          $pagesTo.val(failureList.map(function (v) {
            return v[1];
          }).join("\n"));
          $progress.empty();
          $pagesFrom.removeAttr("disabled");
          $pagesTo.removeAttr("disabled");
          processFlag = false;
        }
      };
      for (i in queryResults) {
        pageinfo[queryResults[i].title] = queryResults[i];
      }
      for (i in pageList) {
        var frompage = pageinfo[pageList[i][0]];
        if (
          frompage.ns === 6 && // is file page
          frompage.missing !== "" && // page is created
          frompage.redirect !== "" // page is not a redirect
        ) {
          deleteRedirectList.push(pageList[i]);
        } else {
          simpleRedirectList.push(pageList[i]);
        }
      }
      if (deleteRedirectList.length > 0) {
        if (!config.wgUserGroups.some(function (g) {
          return groupsWithDeletePerm.includes(g);
        })) {
          for (i in deleteRedirectList) {
            modalConsoleLog("consoleDeleteNoPerm", colorWarning, deleteRedirectList[i][0], deleteRedirectList[i][1]);
            failureList.push(deleteRedirectList[i]);
          }
        } else {
          var proceed = confirm(i18n.msg("confirmDeletePages", deleteRedirectList.map(function (v) {
            return v[0];
          }).join("\n")).plain());
          if (proceed) {
            tasksawait++;
            runDeleteRedirectList(deleteRedirectList, failureList).then(finished);
          } else {
            for (i in deleteRedirectList) {
              modalConsoleLog("consoleDeleteSkipped", colorWarning, deleteRedirectList[i][0], deleteRedirectList[i][1]);
              failureList.push(deleteRedirectList[i]);
            }
          }
        }
      }
      runSimpleRedirectList(simpleRedirectList, failureList).then(finished);
    });
  }
  
  function start() {
    if (processFlag) // already started
    return;
    processFlag = true;
    var fromList = $pagesFrom.val().split("\n");
    var toList = $pagesTo.val().split("\n");
    var pageList = [];
    for (var i = 0; i < Math.max(fromList.length, toList.length); i++) {
      var fromPage = (fromList[i] || "").replaceAll("_", " ").trim();
      var toPage = (toList[i] || "").replaceAll("_", " ").trim();
      if (fromPage === "" && toPage === ""); // ignore
      else if (fromPage === "" || toPage === "") {
        alert(i18n.msg("pageCouplingError", i + 1, fromPage, toPage).plain());
        processFlag = false;
        return;
      } else {
        pageList.push([fromPage, toPage]);
      }
    }
    if (pageList.length > 0) {
      $pagesFrom.attr("disabled", "");
      $pagesTo.attr("disabled", "");
      $errorOutput.empty();
      redirectPages(pageList);
    } else
      processFlag = false;
  }
  
  function createForm() {
    return $("<form>").append(
      $("<fieldset>").append(
        $("<p>", {
          text: i18n.msg("inputInstructions").plain()
        }),
        $("<p>", {
          id: "form-progress"
        }),
        $("<div>", {
          id: "form-main-wrapper"
        }).append(
          $("<div>").append(
            $("<p>", {
              text: i18n.msg("inputPagesFrom").plain() + ":"
            }),
            $("<textarea>", {
              id: "text-pages-from"
            })
          ),
          $("<div>").append(
            $("<p>", {
              text: i18n.msg("inputPagesTo").plain() + ":"
            }),
            $("<textarea>", {
              id: "text-pages-to"
            })
          )
        ),
        $("<p>", {
          text: i18n.msg("errorsForm").plain() + ":"
        }),
        $("<div>", {
          id: "text-error-output"
        })
      )
    ).prop("outerHTML");
  }
  
  function click() {
    if (myModal) {
      myModal.show();
      return;
    }
    myModal = new window.dev.modal.Modal({
      content: createForm(),
      id: "batchredirect-form",
      size: "large",
      title: i18n.msg("modalTitle").escape(),
      buttons: [{
        id: "batchredirect-start",
        text: i18n.msg("initiate").escape(),
        primary: true,
        event: "start"
      }],
      events: {
        start: start
      }
    });
    myModal.create();
    $form = $('#batchredirect-form');
    $progress = $form.find('#form-progress');
    $pagesFrom = $form.find('#text-pages-from');
    $pagesTo = $form.find('#text-pages-to');
    $errorOutput = $form.find('#text-error-output');
    myModal.show();
  }
  
  function init() {
    api = new mw.Api();
    mw.libs.PowertoolsPlacement.addPortletLink(mw.config.values.skin, {
      id: 't-batchredirect',
      href: '#',
      label: i18n.msg('toolsTitle').plain(),
      tooltip: 'AjaxBatchRedirect',
      onClick: click
    });
  }
  
  var preloadsLeft = 3;
  
  function preload() {
    if (--preloadsLeft === 0) { // all preloads complete
      mw.loader.using([
        "mediawiki.api",
        "mediawiki.user"
      ]).then(init);
    }
  }
  mw.hook("dev.modal").add(preload);
  mw.hook('dev.powertools.placement').add(preload);
  loadMessages().then(function (messages) {
    i18n = messages;
    preload();
  });
  
  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
})(jQuery, mediaWiki);